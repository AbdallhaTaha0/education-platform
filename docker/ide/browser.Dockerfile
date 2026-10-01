# Inspection-only browser tooling, never the student execution image.
FROM fayq-review-browser:0.8.0-local
RUN npm install --global agent-browser@0.20.0 && npm cache clean --force
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
CMD ["agent-browser", "--help"]
