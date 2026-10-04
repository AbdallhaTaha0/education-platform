"""One code/input pair per container. No tests, answers, keys or controller files."""
import io
import json
import resource
import sys

resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, 128 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
resource.setrlimit(resource.RLIMIT_NPROC, (16, 16))
request = json.loads(sys.stdin.read(200000))
source, input_text = request["source"], request["input"]
if not isinstance(source, str) or len(source) > 32768 or not isinstance(input_text, str) or len(input_text) > 8192:
    sys.exit(1)
sys.stdin = io.StringIO(input_text)
try:
    exec(compile(source, "student.py", "exec"), {"__name__": "__main__"})
except SystemExit:
    # Preserve Python's normal exit-status semantics; output is still compared
    # by the trusted controller, so exiting zero cannot fabricate a pass.
    raise
except BaseException as error:
    # Source/output stays private to its owner; official grading exposes no traceback.
    sys.stderr.write(type(error).__name__ + ": " + str(error)[:1000] + "\n")
    sys.exit(1)
