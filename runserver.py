import sys
import argparse
import app.routes.prelimroutes as prelimroutes

#-----------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        prog='runserver.py',
        description='The PUAM ArtScape web application')
    parser.add_argument('port', type=int,
        help='the port at which the development server should listen')
    return parser.parse_args()


def main():
    args = parse_args()
    try:
        prelimroutes.app.run(host='0.0.0.0', port=args.port, debug=True)
    except Exception as ex:
        print(f'{sys.argv[0]}: {ex}', file=sys.stderr)
        sys.exit(1)

#-----------------------------------------------------------------------

if __name__ == '__main__':
    main()