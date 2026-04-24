import os
import sys
from app.routes.prelimroutes import app
from dotenv import load_dotenv

# -----------------------------------------------------------------------

load_dotenv()
my_port = os.getenv("B_PORT", 8000)

# -----------------------------------------------------------------------


def main():
    try:
        app.run(host="0.0.0.0", port=my_port, debug=True)
    except Exception as ex:
        print(f"{sys.argv[0]}: {ex}", file=sys.stderr)
        sys.exit(1)


# -----------------------------------------------------------------------

if __name__ == "__main__":
    main()
