import os
import sys
import app.routes.prelimroutes as prelimroutes
from dotenv import load_dotenv

#-----------------------------------------------------------------------

load_dotenv()
my_port = os.getenv("PORT")

#-----------------------------------------------------------------------

def main():
    try:
        prelimroutes.app.run(host='0.0.0.0', port=my_port, debug=True)
    except Exception as ex:
        print(f'{sys.argv[0]}: {ex}', file=sys.stderr)
        sys.exit(1)

#-----------------------------------------------------------------------

if __name__ == '__main__':
    main()