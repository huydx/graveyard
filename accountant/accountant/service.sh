#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$SCRIPT_DIR/.service.pid"
LOGFILE="$SCRIPT_DIR/.service.log"
HOST="${ACCOUNTANT_HOST:-0.0.0.0}"
PORT="${ACCOUNTANT_PORT:-8765}"

_is_running() {
    if [ -f "$PIDFILE" ]; then
        local pid
        pid=$(cat "$PIDFILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

start() {
    if _is_running; then
        echo "Service is already running (PID $(cat "$PIDFILE"))."
        return 1
    fi

    if [ -d "$SCRIPT_DIR/.venv" ]; then
        source "$SCRIPT_DIR/.venv/bin/activate"
    fi

    echo "Starting service on $HOST:$PORT ..."
    nohup python -m uvicorn accountant.server:app \
        --host "$HOST" \
        --port "$PORT" \
        >> "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    echo "Started (PID $(cat "$PIDFILE")). Log: $LOGFILE"
}

stop() {
    if ! _is_running; then
        echo "Service is not running."
        rm -f "$PIDFILE"
        return 0
    fi

    local pid
    pid=$(cat "$PIDFILE")
    echo "Stopping service (PID $pid) ..."
    kill "$pid"

    # Wait up to 10s for graceful shutdown
    for _ in $(seq 1 10); do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "Stopped."
            rm -f "$PIDFILE"
            return 0
        fi
        sleep 1
    done

    # Force kill if still running
    echo "Force-killing ..."
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "Stopped."
}

status() {
    if _is_running; then
        echo "Running (PID $(cat "$PIDFILE")). Port: $PORT"
    else
        echo "Not running."
    fi
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; start ;;
    status)  status ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
