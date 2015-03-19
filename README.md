# Momo

Momo is a template based on Cordova/Phonegap that aims to easily design some
cross-platform applications. The whole application content is described in a
JSON manifest and It implements its own self-update mecanisms.

## Debug Package

Scan the following QRCode to install the debug version of the package :

![qr_code_image](https://chart.googleapis.com/chart?chs=116x116&cht=qr&chl=https://build.phonegap.com/apps/1327372/install/VR56zMQ89Zu_NZyDNq_s&chld=L|1&choe=UTF-8 "Momo Debug Application")

## Installation

Clone the repo:

    git clone ssh://git@repos.entrouvert.org/momo && cd momo/

With [node](http://nodejs.org/) installed (avoid outdated *apt-get* package):

    sudo npm install phonegap -g

Install cordovas plugins:

    phonegap plugin add org.apache.cordova.file-transfer
    phonegap plugin add org.chromium.zip
    phonegap plugin add org.apache.cordova.inappbrowser  # optional

If plugin registry server seems to be down :'( use git instead ;)

    phonegap plugin add https://github.com/apache/cordova-plugin-file.git
    phonegap plugin add https://github.com/apache/cordova-plugin-file-transfer.git
    phonegap plugin add https://github.com/MobileChromeApps/zip.git
    phonegap plugin add https://github.com/apache/cordova-plugin-inappbrowser.git

## Assets Management

Momo implements a self-update mecanism based on AJAX, localStorage, cordova
file transfer and chromium zip. The *meta* section in the manifest
`www/index.json` allows to give some parameters to the update :

    {"meta": {

        // Application Title
        "title": "Ma ville au quotidien",

        // Icon (a new build is required in oder to change the application launcher icon)
        "icon": "icon.png",

        // Footer contact
        "contact": "info@example.net",

        // Update Frequency (in seconds)
        "updateFreq": 100,                                    

        // Distant manifest url
        "updateUrl": "http://localhost/momo/index.json?0.0.1",

        // Distant assets archive
        "assetsUrl": "http://localhost/momo/assets.zip?0.0.1"

    }, ...}

And here is what is supposed to be the content of `assets.zip`:

- `index.js`: Some extra script to be loaded dynamically in the application
- `index.css`: A css stylesheet that will be injected as well
- `*.[png,woff,...]`: images, fonts & other static files

In the `www/index.json` pages content, you must specify url to you assets using
relative path prefixed with `assets/`, like so:

    {
        "title": "Ma ville",
        "content": "<p>Bienvenue !</p><img src='assets/dijon.jpg' class='momo-image' />"
    }

In stylesheets however, you should only be able to give relative references , as
such:

    background: img(../img/bg.png) top left repeat;

Don't forget to enable CORS on the server that will distribute the assets.

- Nginx: `add_header Access-Control-Allow-Origin *;`
- Apache: `Header set Access-Control-Allow-Origin "*"` (.htaccess will do)

You want to make sure the server keeps a cache version of the asset according to
the `updateFreq` value in the JSON manifest.

## Work in development

The cordovas libraries wont work in development environment, so you may want to
set a local path where to get the already unzipped assets. In `www/js/index.js`:

    var DEBUG_WWW_URL = 'http://localhost/momo/www/';

In order to start a dev server, use command:

    phonegap serve

Then point your browser to [http://localhost:3000/](http://localhost:3000/). You
may get a *HTTP Error 500* for cordova.js and *TypeError: Arguments to path.join
must be strings* in your console. This is due to your localmachine that doesn't
expose the sensors and the software components supported by cordova. But those
errors aren't blocking, you can keep doing stuff.

There is a much more convenient way to test you app which is to use the
[PhoneGap Developper App](http://app.phonegap.com/). With this, you'll be able
to test your app directly into you device. Note that cordova's plugins and
librairies are not usable using `phonegap serve`, so you must provide some
environement hooks in your code.

Make sure you don't browse the app twice at the same time, the phonegap's
autoreload mechanism uses socket.io that gets confused and keeps reloading the
app. If anyhow you wish to use many browsers in parallel, you may want to
launch the server with the option :

    phonegap serve --no-autoreload

## Define target platforms

First, add the plateforms you wish to build a new release on:

Before you can build the project, you need to specify a set of target platforms.
Your ability to run these commands depends on whether your machine supports each
SDK, and whether you have already installed each SDK.

Run any of these from a Mac:

    phonegap platform add ios
    phonegap platform add amazon-fireos
    phonegap platform add android
    phonegap platform add blackberry10
    phonegap platform add firefoxos

Run any of these from a Windows machine, where wp refers to different versions
of the Windows Phone operating system:

    phonegap platform add wp8
    phonegap platform add windows
    phonegap platform add amazon-fireos
    phonegap platform add android
    phonegap platform add blackberry10
    phonegap platform add firefoxos

Run this to check your current set of platforms:

    phonegap platforms ls

See more on [Cordova CLI
Interface](http://cordova.apache.org/docs/en/4.0.0/guide_cli_index.md.html)

## Build Application

Then in order to build application for all configured platform, use:

    phonegap build

You can also build for a specific platform [`ios`, `android`, etc.]:

    phongap build <platform>

To build a new "ready-to-publish" release, use the flag:
    
    phongap build --release

Find the built releases in the `platforms/` folder.
    
## License

Momo is licensed under the [GNU General Public License v3.0](http://www.gnu.org/) 
