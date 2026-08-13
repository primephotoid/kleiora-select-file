package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"

	"kleiora-backend/internal/config"

	_ "github.com/go-sql-driver/mysql"
)

// iso8601Re mencocokkan datetime ISO 8601 di dalam string SQL (mis. '2026-08-13T22:15:18.28+08:00')
var iso8601Re = regexp.MustCompile(`'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?'`)

// fixDatetime mengubah ISO 8601 ke format datetime MySQL.
func fixDatetime(query string) string {
	return iso8601Re.ReplaceAllString(query, "'$1 $2'")
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: db-import <path-to-dump.sql>")
	}
	sqlFile := os.Args[1]

	cfg := config.LoadConfig()

	// Buka koneksi tanpa database (untuk eksekusi CREATE DATABASE di dalam dump)
	dsn := stripDatabase(cfg.DatabaseURL)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Gagal membuka koneksi MySQL: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		log.Fatalf("Gagal terhubung ke MySQL: %v", err)
	}
	log.Printf("Terhubung ke MySQL. Mengimpor: %s", sqlFile)

	file, err := os.Open(sqlFile)
	if err != nil {
		log.Fatalf("Gagal membuka file SQL: %v", err)
	}
	defer file.Close()

	if err := executeSQL(db, file); err != nil {
		log.Fatalf("Import gagal: %v", err)
	}

	log.Println("Import database berhasil!")
}

// executeSQL membaca file SQL dan menjalankan setiap statement satu per satu.
func executeSQL(db *sql.DB, file *os.File) error {
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024) // buffer 10 MB

	var statement strings.Builder
	lineNum := 0
	executed := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		// Lewati komentar dan baris kosong
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") || strings.HasPrefix(trimmed, "/*") {
			continue
		}

		statement.WriteString(line)
		statement.WriteByte('\n')

		// Jalankan statement saat menemukan titik-koma di akhir baris
		if strings.HasSuffix(trimmed, ";") {
			query := fixDatetime(strings.TrimSpace(statement.String()))
			if query != "" && query != ";" {
				if _, err := db.Exec(query); err != nil {
					return fmt.Errorf("baris %d: %w\nQuery: %s", lineNum, err, truncate(query, 200))
				}
				executed++
				if executed%50 == 0 {
					log.Printf("  %d statement dieksekusi...", executed)
				}
			}
			statement.Reset()
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("gagal membaca file: %w", err)
	}

	// Eksekusi sisa statement jika tidak diakhiri titik-koma
	if remaining := strings.TrimSpace(statement.String()); remaining != "" {
		if _, err := db.Exec(remaining); err != nil {
			return fmt.Errorf("statement terakhir: %w", err)
		}
		executed++
	}

	log.Printf("Total %d statement berhasil dieksekusi.", executed)
	return nil
}

// stripDatabase menghapus nama database dari DSN agar bisa eksekusi CREATE DATABASE.
func stripDatabase(dsn string) string {
	// Format: user:pass@tcp(host:port)/dbname?params
	slashIdx := strings.LastIndex(dsn, "/")
	if slashIdx == -1 {
		return dsn
	}
	questionIdx := strings.Index(dsn[slashIdx:], "?")
	var params string
	if questionIdx != -1 {
		params = dsn[slashIdx+questionIdx:]
	}
	return dsn[:slashIdx+1] + params
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
