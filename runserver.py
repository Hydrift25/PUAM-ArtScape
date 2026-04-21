import os
import sys
from app.routes.prelimroutes import app
from dotenv import load_dotenv
from image_verify_worker import worker_loop
from app.routes.prelimroutes import socketio
import threading

#-----------------------------------------------------------------------

load_dotenv()
my_port = os.getenv("B_PORT", 8000)

#-----------------------------------------------------------------------

def main():
    try:
        print("Starting image verification worker...")

        worker = threading.Thread(target=worker_loop, args=(socketio,), daemon=True)
        worker.start()

        socketio.run(app, host='0.0.0.0', port=my_port, debug=True, use_reloader=False)
    except Exception as ex:
        print(f'{sys.argv[0]}: {ex}', file=sys.stderr)
        sys.exit(1)

#-----------------------------------------------------------------------

if __name__ == '__main__':
    main()