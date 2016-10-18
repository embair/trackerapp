## Prerekvizity
* node
* npm
* redis-server
* aplikace očekává lokálně běžící redis-server na výchozím portu 6379

## Použití

Instalace, spuštění, spuštění testů:
```
npm install
npm start
npm test
```

Aplikace podporuje několik parametrů na příkazové řádce, viz `node server.js -h`

## Zdrojové soubory

* `server.js` ... zaváděcí skript aplikace
* `http-listener.js` ... poskytuje factory metodu `create(options)`, jejíž 
prostřednictvím lze vytvářet instance http listenerů, zpracovávajících HTTP 
requesty na routách /count a /track podle zadané specifikace 
* `spec/http-listener.spec.js` ... unit test HTTP listeneru, který používá mock 
objekty místo databáze a dump filu 

## Poznámky k implementaci

* Různé detaily, které nebyly v zadání specifikovány, jsem si domyslel následně:
  * aplikace nespouští vlastní redis server, očekává že tento již běží a poslouchá na portu 6379 (případně jiném, viz parametr --redis-port)
  * při startu aplikace je hodnota 'count' v redis databázi inicializována na hodnotu 0
  * v /track requestech je parametr 'count' tiše ignorován, pokud není kladné číslo; desetinné hodnoty jsou oříznuty na celá čísla

* Původně jsem plánoval, že server.js bude vytvářet s pomocí modulu cluster několik instancí http-listeneru (podle počtu jader CPU), ale testování výkonu (prováděné pomocí apache ab) mě upozornilo na to, že to nemá valný smysl. Veškerý synchronně prováděný kód listeneru je natolik triviální, že zvýšení počtu procesů se na počtu zpracovaných requestů za sekundu měřitelně neprojevilo.

* Došel jsem k závěru, že zápis do souboru ani interakce s redis databází aktuálně netvoří výkonnostní bottleneck ( úplné zakomentování těchto operací zvýšilo množství odbavených requestů za sekundu jen o několik procent), takže jsem se u nich nepokoušel o žádnou pokročilejší optimalizaci. 