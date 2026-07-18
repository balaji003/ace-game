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

type PlayedCard struct {
	Player string `json:"player"`
	Card   string `json:"card"`
}

type AIMoveRequest struct {
	Player       string              `json:"player"`
	Hand         []string            `json:"hand"`
	LedSuit      string              `json:"ledSuit"`
	ValidMoves   []string            `json:"validMoves"`
	RoundCards   []PlayedCard        `json:"roundCards"`
	PlayersAfter []string            `json:"playersAfter"`
	Voids        map[string][]string `json:"voids"`
	Counts       map[string]int      `json:"counts"`
	Recent       []string            `json:"recent"`
}
