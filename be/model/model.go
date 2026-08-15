package model

import "time"

type Stats struct {
	Played        int `json:"played"`
	Wins          int `json:"wins"`
	Losses        int `json:"losses"`
	CurrentStreak int `json:"current_streak"`
	BestStreak    int `json:"best_streak"`
}

type Game struct {
	ID        int64     `json:"id"`
	PlayedAt  time.Time `json:"played_at"`
	Won       bool      `json:"won"`
	Placement int       `json:"placement"`
	Mode      string    `json:"mode"`
	Opponents []string  `json:"opponents"`
}

type RecordGameRequest struct {
	Won       bool     `json:"won"`
	Placement int      `json:"placement"`
	Mode      string   `json:"mode"`
	Opponents []string `json:"opponents"`
}

