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

// fixCollation mengganti collation MariaDB baru dengan collation utf8mb4 yang
// tersedia luas pada MySQL/MariaDB versi server produksi.
func fixCollation(query string) string {
	return strings.ReplaceAll(query, "utf8mb4_uca1400_ai_ci", "utf8mb4_unicode_ci")
}

// fixIndexedText membuat indeks hasil dump MariaDB kompatibel dengan MySQL
// yang tidak mengizinkan LONGTEXT sebagai key tanpa panjang prefix.
func fixIndexedText(query string) string {
	for _, column := range []string{"code", "slug", "email"} {
		query = strings.ReplaceAll(query, "`"+column+"` longtext", "`"+column+"` varchar(191)")
	}
	return strings.ReplaceAll(query, " USING HASH", "")
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: db-import <path-to-dump.sql>")
	}
	sqlFile := os.Args[1]

	cfg := config.LoadConfig()

	// Selalu impor ke database yang dipilih DATABASE_URL. Nama database di dalam
	// file dump dapat berasal dari environment lain dan tidak boleh mengalihkan
	// target import.
	db, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Gagal membuka koneksi MySQL: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		log.Fatalf("Gagal terhubung ke MySQL: %v", err)
	}
	var databaseName string
	if err := db.QueryRow("SELECT DATABASE()").Scan(&databaseName); err != nil || databaseName == "" {
		log.Fatal("DATABASE_URL tidak memilih database")
	}
	log.Printf("Terhubung ke database %s. Mengimpor: %s", databaseName, sqlFile)

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
			query := fixIndexedText(fixCollation(fixDatetime(strings.TrimSpace(statement.String()))))
			upperQuery := strings.ToUpper(query)
			if strings.HasPrefix(upperQuery, "CREATE DATABASE ") || strings.HasPrefix(upperQuery, "USE ") {
				statement.Reset()
				continue
			}
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

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
