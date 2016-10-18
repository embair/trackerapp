## Prerekvizity
* node
* npm
* redis-server
* aplikace očekává lokálně běžící redis-server na výchozím portu 6379

## Použití
```
npm install
npm start
npm test
```

## Zdrojové soubory

* server.js ... zaváděcí skript aplikace
* http-listener.js ... poskytuje factory metodu `create(options)`, jejíž 
prostřednictvím lze vytvářet instance http listenerů, zpracovávajících HTTP 
requesty na routách /count a /track podle zadané specifikace 
* spec/http-listener.spec.js ... unit test HTTP listeneru, který používá mock 
objekty místo databáze a dump filu 

## Poznámky k implementaci