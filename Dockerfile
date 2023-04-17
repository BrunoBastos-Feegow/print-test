FROM node:14
# Install required dependencies for Chromium
RUN apt-get update && \
    apt-get install -y libnss3 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 \
            libxrandr2 libxss1 libxtst6 libglib2.0-0 libnss3-tools libatk-bridge2.0-0 libgtk-3-0 libx11-6 \
            libxcb1 libxext6 libxrender1 libgbm-dev wget libasound2
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
RUN chmod +x /app/entrypoint.sh
CMD [ "node", "app.js" ]

#redirect requests for this container at port 8000 to the hostmachine at port 8000
EXPOSE 8000

#ENTRYPOINT ["/app/entrypoint.sh"]
#ENTRYPOINT ["/app/entrypoint.sh", "node", "app.js"]