package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kleiora-backend/internal/config"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	cfg := config.LoadConfig()
	db, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Gagal membuka koneksi MySQL: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("Gagal terhubung ke MySQL: %v", err)
	}

	var databaseName string
	if err := db.QueryRow("SELECT DATABASE()").Scan(&databaseName); err != nil || databaseName == "" {
		log.Fatal("DATABASE_URL tidak memilih database")
	}

	dumpDir := os.Getenv("DUMP_DIR")
	if dumpDir == "" {
		dumpDir = filepath.Join("database", "dumps")
	}
	if err := os.MkdirAll(dumpDir, 0o750); err != nil {
		log.Fatalf("Gagal membuat folder dump: %v", err)
	}

	fileName := fmt.Sprintf("%s-%s.sql", safeFileName(databaseName), time.Now().Format("20060102-150405"))
	dumpPath := filepath.Join(dumpDir, fileName)
	file, err := os.OpenFile(dumpPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		log.Fatalf("Gagal membuat file dump: %v", err)
	}

	writer := bufio.NewWriterSize(file, 256*1024)
	dumpErr := writeDump(db, writer, databaseName)
	flushErr := writer.Flush()
	closeErr := file.Close()
	if dumpErr != nil || flushErr != nil || closeErr != nil {
		_ = os.Remove(dumpPath)
		switch {
		case dumpErr != nil:
			log.Fatalf("Gagal membuat dump: %v", dumpErr)
		case flushErr != nil:
			log.Fatalf("Gagal menulis dump: %v", flushErr)
		default:
			log.Fatalf("Gagal menutup dump: %v", closeErr)
		}
	}

	info, err := os.Stat(dumpPath)
	if err != nil {
		log.Fatalf("Dump selesai tetapi tidak dapat diverifikasi: %v", err)
	}
	log.Printf("Dump database %s berhasil: %s (%d bytes)", databaseName, dumpPath, info.Size())
}

func writeDump(db *sql.DB, writer *bufio.Writer, databaseName string) error {
	if _, err := fmt.Fprintf(writer, "-- Kleiora MySQL database dump\n-- Database: %s\n-- Dibuat: %s\n\n", databaseName, time.Now().Format(time.RFC3339)); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nCREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE %s;\n\n", quoteIdentifier(databaseName), quoteIdentifier(databaseName)); err != nil {
		return err
	}

	tables, err := tableNames(db)
	if err != nil {
		return err
	}
	for _, table := range tables {
		if err := dumpTable(db, writer, table); err != nil {
			return fmt.Errorf("tabel %s: %w", table, err)
		}
	}
	_, err = writer.WriteString("SET FOREIGN_KEY_CHECKS=1;\n")
	return err
}

func tableNames(db *sql.DB) ([]string, error) {
	rows, err := db.Query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name, tableType string
		if err := rows.Scan(&name, &tableType); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

func dumpTable(db *sql.DB, writer *bufio.Writer, table string) error {
	var name, createStatement string
	if err := db.QueryRow("SHOW CREATE TABLE "+quoteIdentifier(table)).Scan(&name, &createStatement); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer, "-- Struktur tabel %s\nDROP TABLE IF EXISTS %s;\n%s;\n\n", quoteIdentifier(table), quoteIdentifier(table), createStatement); err != nil {
		return err
	}

	rows, err := db.Query("SELECT * FROM " + quoteIdentifier(table))
	if err != nil {
		return err
	}
	defer rows.Close()
	columns, err := rows.Columns()
	if err != nil {
		return err
	}

	columnList := make([]string, len(columns))
	for index, column := range columns {
		columnList[index] = quoteIdentifier(column)
	}
	rowCount := 0
	for rows.Next() {
		values := make([]sql.RawBytes, len(columns))
		destinations := make([]any, len(columns))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := rows.Scan(destinations...); err != nil {
			return err
		}
		encoded := make([]string, len(values))
		for index, value := range values {
			if value == nil {
				encoded[index] = "NULL"
			} else {
				encoded[index] = quoteValue(value)
			}
		}
		if _, err := fmt.Fprintf(writer, "INSERT INTO %s (%s) VALUES (%s);\n", quoteIdentifier(table), strings.Join(columnList, ", "), strings.Join(encoded, ", ")); err != nil {
			return err
		}
		rowCount++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = fmt.Fprintf(writer, "-- %d baris dari %s\n\n", rowCount, quoteIdentifier(table))
	return err
}

func quoteIdentifier(value string) string {
	return "`" + strings.ReplaceAll(value, "`", "``") + "`"
}

func quoteValue(value []byte) string {
	var builder strings.Builder
	builder.Grow(len(value) + 2)
	builder.WriteByte('\'')
	for _, char := range value {
		switch char {
		case 0:
			builder.WriteString("\\0")
		case '\n':
			builder.WriteString("\\n")
		case '\r':
			builder.WriteString("\\r")
		case '\\':
			builder.WriteString("\\\\")
		case '\'':
			builder.WriteString("\\'")
		case 26:
			builder.WriteString("\\Z")
		default:
			builder.WriteByte(char)
		}
	}
	builder.WriteByte('\'')
	return builder.String()
}

func safeFileName(value string) string {
	cleaned := safeNameReplacer.Replace(value)
	return strings.Trim(cleaned, "-")
}

var safeNameReplacer = strings.NewReplacer("/", "-", "\\", "-", " ", "-")
