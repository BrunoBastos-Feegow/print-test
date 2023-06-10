### PDF SERVICE
- this is a poc for a pdf service to try and solve the problem of printing custom html forms 
- the service is built using the puppeteer library to generate pdfs from html

### HOW TO USE (with docker)
- clone the repo
- run docker-compose up --build -d to build the image and run the container
- checkout the print-pdf branch of the feegow-api repository
- make sure your .env file has the APP_ENV set to anything other than 'production'
- start the feegow-api service (php artisan serve)
- make a get request to http://localhost:8000/teste-pdf-node/{licenca_id}/{documento_tipo}/{documento_id}, where:
  - licenca_id is the id of the license you want to use
  - documento_tipo is the type of document you want to generate (it can be 'form' ou 'atestado')
  - documento_id is the id of the document you want to generate

### HOW TO USE (without docker)
- clone the repo
- run npm install
- run npm start
- checkout the print-pdf branch of the feegow-api repository
- make sure your .env file has the APP_ENV set to anything other than 'production'
- start the feegow-api service (php artisan serve)
- make a get request to http://localhost:8000/teste-pdf-node/{licenca_id}/{documento_tipo}/{documento_id}, where:
  - licenca_id is the id of the license you want to use
  - documento_tipo is the type of document you want to generate (it can be 'form' ou 'atestado')
  - documento_id is the id of the document you want to generate

## Some usecases
- ecodopler (gridster): http://localhost:8000/teste-pdf-node/20102/form/289
- PRO-753 (audiometria): http://localhost:8000/teste-pdf-node/18755/form/324052
- image height: http://localhost:8000/teste-pdf-node/10521/form/4596