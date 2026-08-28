package services

import (
	"sort"
	"strings"
)

// SortFileNamesNatural returns a sorted copy so numbered file names follow the
// order people expect: photo-2.jpg comes before photo-10.jpg.
func SortFileNamesNatural(files []string) []string {
	sorted := append([]string(nil), files...)
	sort.SliceStable(sorted, func(i, j int) bool {
		return naturalFileNameLess(sorted[i], sorted[j])
	})
	return sorted
}

func naturalFileNameLess(left, right string) bool {
	a, b := strings.ToLower(left), strings.ToLower(right)
	for i, j := 0, 0; i < len(a) && j < len(b); {
		if isASCIIDigit(a[i]) && isASCIIDigit(b[j]) {
			iEnd, jEnd := i, j
			for iEnd < len(a) && isASCIIDigit(a[iEnd]) {
				iEnd++
			}
			for jEnd < len(b) && isASCIIDigit(b[jEnd]) {
				jEnd++
			}
			aNumber := strings.TrimLeft(a[i:iEnd], "0")
			bNumber := strings.TrimLeft(b[j:jEnd], "0")
			if aNumber == "" {
				aNumber = "0"
			}
			if bNumber == "" {
				bNumber = "0"
			}
			if len(aNumber) != len(bNumber) {
				return len(aNumber) < len(bNumber)
			}
			if aNumber != bNumber {
				return aNumber < bNumber
			}
			if iEnd-i != jEnd-j {
				return iEnd-i < jEnd-j
			}
			i, j = iEnd, jEnd
			continue
		}
		if a[i] != b[j] {
			return a[i] < b[j]
		}
		i++
		j++
	}
	if len(a) != len(b) {
		return len(a) < len(b)
	}
	return left < right
}

func isASCIIDigit(value byte) bool {
	return value >= '0' && value <= '9'
}
