#!/bin/bash
unset ELECTRON_RUN_AS_NODE
exec ./node_modules/.bin/electron "$@"
