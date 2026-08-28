package services

import (
	"reflect"
	"testing"
)

func TestSortFileNamesNaturalAscending(t *testing.T) {
	input := []string{"Primephoto-37.jpg", "Primephoto-10.jpg", "Primephoto-2.jpg", "Primephoto-1.jpg", "Primephoto-02.jpg"}
	want := []string{"Primephoto-1.jpg", "Primephoto-2.jpg", "Primephoto-02.jpg", "Primephoto-10.jpg", "Primephoto-37.jpg"}

	got := SortFileNamesNatural(input)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected natural order: got %v, want %v", got, want)
	}
	if input[0] != "Primephoto-37.jpg" {
		t.Fatal("sorting mutated the caller's slice")
	}
}
