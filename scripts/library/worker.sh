#!/usr/bin/env bash
# Processes plans appended to out/todo.txt one by one (render + review via queue.sh).
#   bash scripts/library/worker.sh [queues_to_wait_for]
# Waits first until out/queue.log holds that many QUEUE_DONE lines. Stops on a STOP line.
cd "$(dirname "$0")/../.."
need=${1:-0}
until [ "$(grep -c QUEUE_DONE out/queue.log 2>/dev/null || echo 0)" -ge "$need" ]; do sleep 15; done
touch out/todo.txt
while true; do
  line=$(head -n1 out/todo.txt)
  if [ -z "$line" ]; then sleep 15; continue; fi
  sed -i '1d' out/todo.txt
  [ "$line" = STOP ] && break
  bash scripts/library/queue.sh $line
done
