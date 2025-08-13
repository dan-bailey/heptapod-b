Application overview:
I want to build a web app that primarily uses Python on the back-end to create a logogram in Heptapod-B.  It should have consistency in the repeated graphemes.  For more on the Heptapod-B language, consult [Wikipedia: Heptapod languages](https://en.wikipedia.org/wiki/Heptapod_languages).  You can also look at an [archive of Heptapod-B logograms](https://github.com/WolframResearch/Arrival-Movie-Live-Coding/tree/master/ScriptLogoJpegs), and for what chatGPT produced, there is script.js in this project folder.

Requirements:
* A user should be able to generate a Heptapod B logogram for a provided phrase.
* Graphemes for individual words should be consistent from logogram to logogram -- that is to say if a word like "cat" must be created, "cat" should be approximately the same in each instance going forward, so we'll need to store those graphemes on the server.
* An end-user should be able to download the SVG file for their own use.
* There should be a .env file for the admin to be able to delineate where generated SVG files are saved, as those should be archived, along with individual graphemes.

Architecture and Design:
Let's build a Flask-based single-page app, that has a lightweight front-end, and uses an API-style endpoint to request an SVG from the server.  The tech stack should include:
* Python 3.12
* Flask
* HTML/CSS
* Bootstrap
* vanilla Javascript
* pytest
* jest

Tasks:

Coding Standards and Conventions:
* use clean Python 3.12 formatted code that conforms to Python best practices
* use ES6-compatible Javascript

Testing Plan:
* unit testing; please 

Error Handling: