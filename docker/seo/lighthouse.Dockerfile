FROM fayq-seo-browser:20261006
WORKDIR /audit
RUN npm install --save-exact lighthouse@13.5.0
ENV CHROME_PATH=/usr/bin/chromium
ENTRYPOINT ["/audit/node_modules/.bin/lighthouse"]
