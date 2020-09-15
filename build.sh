#!/bin/bash

function script_usage() {
    cat << EOF
Usage:
    -h, --help                  Displays this help
    --tag                 docker tag for build
EOF
}

if [[ $# -eq 0 ]]; then
script_usage
exit 0
fi

while [[ $# -ge 1 ]]; do
  case "$1" in
    -h | --help)
      script_usage;
      exit 0
      shift 2;;
    --tag)
      tag=($2); shift 2;;
    *)
      echo "Invalid parameter was provided: $1"
      script_usage
      exit 0
      break;;
  esac
done

$(aws ecr get-login --no-include-email --region ap-northeast-2)
docker build -t labeling_app:$tag .
docker tag labeling_app:$tag 153768889480.dkr.ecr.ap-northeast-2.amazonaws.com/labeling_app:$tag
docker push 153768889480.dkr.ecr.ap-northeast-2.amazonaws.com/labeling_app:$tag