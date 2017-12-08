# QEWD: Quick and Easy Web Developer

[![Build Status](https://travis-ci.org/robtweed/qewd.svg?branch=tests)](https://travis-ci.org/robtweed/qewd) [![Coverage Status](https://coveralls.io/repos/github/robtweed/qewd/badge.svg?branch=tests)](https://coveralls.io/github/robtweed/qewd?branch=tests) [![Dependency Status](https://gemnasium.com/badges/github.com/robtweed/qewd.svg)](https://gemnasium.com/github.com/robtweed/qewd)

Rob Tweed <rtweed@mgateway.com>  
24 February 2016, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)  

Twitter: [@rtweed](https://twitter.com/rtweed)

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)

Thanks to Ward De Backer for debugging assistance and functionality suggestions.


## What is QEWD?

This is best answered by reading [this article on QEWD](https://robtweed.wordpress.com/2017/04/18/having-your-node-js-cake-and-eating-it-too/).

In summary: [QEWD](http://qewdjs.com) is a Node.js-based platform for developing and running interactive browser-based applications and Web/REST services.

QEWD makes use of the [ewd-qoper8](https://github.com/robtweed/ewd-qoper8) module to provide an isolated run-time environment for each of your message/request handler functions, meaning that your JavaScript handler functions can use synchronous, blocking APIs if you wish / prefer.

QEWD includes an embedded persistent JSON database and session store/cache using Global Storage provided by either the Redis, GT.M or Cache databases.

Interactive QEWD applications can be developed using any client-side JavaScript framework (eg Angular, React, etc).

A single instance of QEWD can simultaneously support multiple browser-based applications and Web/REST services.

QEWD uses Express to provide its outward-facing HTTP(S) interface, and Socket.io to provide its outward-facing Web-socket interface.


## Installing

You can install QEWD.js by typing:

    $ npm install qewd

However, you'll need to then set up the run-time environment manually.

Simpler options are:

- If you're starting from a "clean slate", you should take a look at the [pre-built installer scripts](https://github.com/robtweed/qewd/tree/master/installers)
for Linux and Raspberry Pi systems.

- If you've already installed Node.js, first create a directory to act as the "root" directory for
QEWD, eg: `~/qewdjs`

Then do the following:

    $ cd ~/qewdjs   # or whatever your 'root' directory is
    $ wget https://raw.githubusercontent.com/robtweed/qewd/master/installers/package.json
    $ npm install

This will install QEWD using NPM as before, but then allows you to run a setup script:

    $ npm run setup

Answer the questions it ask you, and it will create a working run-time environment for you.

### Note: this setup script will NOT install one of the databases used by QEWD (eg GT.M, YottaDB, Cache or Redis). You'll need to do this manually. If you want to use Redis, QEWD expects a default installation, listening on port 6379.

For further details on installing and configuring QEWD.js, see [this presentation slide deck](https://www.slideshare.net/robtweed/installing-configuring-ewdxpress).


## Learning / Using QEWD

See the free online [training course](http://docs.qewdjs.com/qewd_training.html)

- Parts 1 to 3 provide background to the core modules and concepts used by QEWD
- Parts 4 onwards focus on QEWD


## Debug

QEWD uses [debug](https://github.com/visionmedia/debug) to show log output.

    $ DEBUG=*ewd* node path/to/your/server.js

![Debug](.github/debug.png?raw=true "Debug")

## Tests

### Unit testing

    $ npm run test:unit

### Integration tests

There are several options to run integration tests. The minimal requirement is that you must have Redis server installed and started. Then you can run integration tests:

    $ npm run test:integration

By default, **Express** framework will be used for creating a web server. However, you can use **Koa** framework if needed:

    $ WEB_SERVER=koa npm run test:integration

#### Note: The command above works with Node.js 7.6+ only.

To run integration tests using another database, you must install and have running this database. Then, run

    $ DATABASE=gtm npm run test:integration

for GT.M or YottaDB, or:

    $ DATABASE=cache npm run test:integration

for InterSystem Caché.

#### Notes:
  1. You can use both `DATABASE` and `WEB_SERVER` in the same time.
  2. You may need to run the command as sudo because of permissions (read [InterSystem Caché](#intersystem-cache) section as well).
  3. GT.M and YottaDB required [nodem](https://github.com/dlwicksell/nodem) binding and driver for the GT.M language and database that works only for Linux based server for now. If you use Windows or Mac OS please read [Vagrant](#vagrant) section.

### Vagrant

Vagrant is used to provide an ability to run integration tests that use *GT.M* and *YottaDB* for non-Linux based servers. You can skip reading this section if you do not need it or if you use Linux machine.

#### Requirements
  - [Oracle VM VirtualBox](https://www.virtualbox.org/wiki/Downloads)  
  - [Vagrant](https://www.vagrantup.com/)  
  - [RVM](https://rvm.io/)  
  - [Bundler](http://bundler.io/)  
  - [Vagrant Omnibus](https://github.com/chef/vagrant-omnibus)  

#### Provision

    $ bundle install
    $ librarian-chef install
    $ vagrant up

#### GT.M Install

    $ vagrant ssh
    $ cd /vagrant
    $ npm install --no-save nodem
    $ ./installers/install_gtm_only.sh
    $ source ~/.profile;
    $ ./installers/install_nodem.sh /vagrant
    $ source ~/.profile

### InterSystem Caché
  - The official web site - [InterSystem Caché](https://www.intersystems.com/products/cache/)
  - You need install `cache.node` in npm global registy. Read [Installation](http://docs.intersystems.com/latest/csp/docbook/DocBook.UI.Page.cls?KEY=BXJS_intro#BXJS_intro_install) to get more details.
  - Run `npm link cache.node` before running integration tests
  - You may need to run this as sudo because of permissions


## License

```
 Copyright (c) 2017 M/Gateway Developments Ltd,                           
 Reigate, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  http://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
```