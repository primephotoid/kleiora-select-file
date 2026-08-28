package models

import (
	"reflect"
	"strings"
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

func TestPersistedStringsHaveExplicitDatabaseType(t *testing.T) {
	models := []any{
		User{},
		Gallery{},
		Package{},
		Portfolio{},
		Review{},
		BookingSequence{},
		Booking{},
		Photo{},
		Selection{},
	}

	for _, model := range models {
		parsed, err := schema.Parse(model, &sync.Map{}, schema.NamingStrategy{})
		if err != nil {
			t.Fatalf("parse %T: %v", model, err)
		}
		for _, field := range parsed.Fields {
			if field.FieldType.Kind() != reflect.String {
				continue
			}
			tag := field.StructField.Tag.Get("gorm")
			if field.Size == 0 && !strings.Contains(strings.ToLower(tag), "type:") {
				t.Errorf("%s.%s must declare gorm size or type", parsed.Name, field.Name)
			}
			if (strings.Contains(strings.ToLower(tag), "index") || strings.Contains(strings.ToLower(tag), "unique")) && field.Size == 0 {
				t.Errorf("indexed field %s.%s must have a finite size", parsed.Name, field.Name)
			}
		}
	}
}
