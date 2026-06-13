package main

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"example.com/config"
	"example.com/handler"
	"example.com/service"
	"example.com/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	conn, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		log.Fatalf("open mysql: %v", err)
	}
	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(5 * time.Minute)
	if err := conn.Ping(); err != nil {
		log.Fatalf("ping mysql: %v", err)
	}
	defer conn.Close()

	st := store.New(conn)
	authSvc := service.NewAuth(st, cfg, service.NewDBSMSSender(st))
	gameSvc := service.NewGame(st)
	aiSvc := service.NewAI(cfg)

	srv := handler.New(cfg, authSvc, gameSvc, aiSvc)
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	log.Printf("ACE backend listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler.CORS(cfg.AllowOrigin, mux)); err != nil {
		log.Fatalf("server: %v", err)
	}
}
