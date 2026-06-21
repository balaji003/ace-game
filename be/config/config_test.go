package config

import (
	"os"
	"testing"
)

// TestPlayerBoundsClamp verifies player counts are always pinned to 3–7,
// regardless of out-of-range, inverted, or invalid env values.
func TestPlayerBoundsClamp(t *testing.T) {
	cases := []struct {
		name             string
		min, max         string
		wantMin, wantMax int
	}{
		{"defaults (unset)", "", "", 3, 7},
		{"testing floor of 2", "2", "7", 2, 7},
		{"below floor", "0", "1", 2, 2},
		{"above ceiling", "9", "10", 7, 7},
		{"min above max → max bumped", "6", "4", 6, 6},
		{"narrowed within range", "4", "6", 4, 6},
		{"invalid strings", "abc", "xyz", 3, 7},
		{"min over ceiling, max unset", "10", "", 7, 7},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			os.Setenv("MIN_PLAYERS", tc.min)
			os.Setenv("MAX_PLAYERS", tc.max)
			defer func() { os.Unsetenv("MIN_PLAYERS"); os.Unsetenv("MAX_PLAYERS") }()

			min := intEnvClamped("MIN_PLAYERS", 3, HardMinPlayers, HardMaxPlayers)
			max := intEnvClamped("MAX_PLAYERS", 7, HardMinPlayers, HardMaxPlayers)
			if max < min {
				max = min
			}
			if min != tc.wantMin || max != tc.wantMax {
				t.Fatalf("min/max = %d/%d, want %d/%d", min, max, tc.wantMin, tc.wantMax)
			}
		})
	}
}
