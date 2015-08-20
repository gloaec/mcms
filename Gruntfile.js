/**
 * Gruntfile
 *
 * If you created your Sails app with `sails new foo --linker`, 
 * the following files will be automatically injected (in order)
 * into the EJS and HTML files in your `views` and `assets` folders.
 *
 * At the top part of this file, you'll find a few of the most commonly
 * configured options, but Sails' integration with Grunt is also fully
 * customizable.  If you'd like to work with your assets differently 
 * you can change this file to do anything you like!
 *
 * More information on using Grunt to work with static assets:
 * http://gruntjs.com/configuring-tasks
 */

module.exports = function (grunt) {

  var cssFilesToInject = [

    // Vendors
    'styles/vendor/**/*.css',

    // All of the rest of your app styles imported here
    'styles/**/*.css'
  ];

  var jsFilesToInject = [

    // Below, as a demonstration, you'll see the built-in dependencies 
    // linked in the proper order order

    // Bring in the socket.io client
    //'scripts/vendor/socket.io.js',

    // A simpler boilerplate library for getting you up and running w/ an
    // automatic listener for incoming messages from Socket.io.
    //'scripts/vendor/app.js',

    // Vendors
    'scripts/vendor/**/*.js',

    // Marionnette Application
    'scripts/config/**/*.js',
    'scripts/app.js',
    'scripts/controllers/**/*.js',
    'scripts/entities/**/*.js',
    'scripts/views/**/*.js',
    'scripts/components/**/*.js',
    'scripts/apps/**/*.js',

    // All of the rest of your app scripts imported here
    'scripts/**/*.js'
  ];

  var templateFilesToInject = [
    'templates/**/*.html',
  ];

  var ecoFilesToInject = [
    'templates/**/*.eco',
    'scripts/**/*.eco',
    'scripts/apps/**/**/templates/*.eco'
  ];

  // Modify css file injection paths to use 
  cssFilesToInject = cssFilesToInject.map(function (path) {
    return 'www/' + path;
  });

  // Modify js file injection paths to use 
  jsFilesToInject = jsFilesToInject.map(function (path) {
    return 'www/' + path;
  });
  
  templateFilesToInject = templateFilesToInject.map(function (path) {
    return 'assets/' + path;
  });

  ecoFilesToInject = ecoFilesToInject.map(function (path) {
    return 'assets/' + path;
  });

  // Get path to core grunt dependencies
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-sails-linker');
  grunt.loadNpmTasks('grunt-contrib-jst');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-coffee');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-eco');
  grunt.loadNpmTasks('grunt-groc');

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    copy: {
      reload: {
        files: [
          {
          expand: true,
          cwd: './assets',
          src: ['templates/core/reload.html'],
          dest: 'www',
          rename: function(dest, src) {
            return dest + '/index.html'
          }
        }
        ]
      },
      dev: {
        files: [
          {
          expand: true,
          cwd: './assets',
          src: ['**/*.!(coffee|scss|sass|eco|haml)'],
          dest: 'www'
        }
        ]
      },
      build: {
        files: [
          {
          expand: true,
          cwd: 'www',
          src: ['**/*'],
          dest: 'www'
        }
        ]
      }
    },

    clean: {
      dev: [
        'www/scripts',
        'www/styles',
        'www/images',
        'www/fonts',
        'www/templates',
        'www/index.html',
        'www/templates.js'
      ],
      build: ['www']
    },

    jst: {
      dev: {

        // To use other sorts of templates, specify the regexp below:
        // options: {
        //   templateSettings: {
        //     interpolate: /\{\{(.+?)\}\}/g
        //   }
        // },

        files: {
        //  'www/jst.js': templateFilesToInject
        }
      }
    },

    eco: {
      dev: {
        files: {
          'www/templates.js': ecoFilesToInject
        }
      }
    },

    less: {
      dev: {
        files: [
          {
            expand: true,
            cwd: 'assets/styles/',
            src: ['*.less'],
            dest: 'www/styles/',
            ext: '.css'
          }
        ]
      }
    },

    sass: {
      dev: {
        files: [
          {
            expand: true,
            cwd: 'assets/styles/',
            src: ['*.scss', '*.sass'],
            dest: 'www/styles/',
            ext: '.css'
          }
        ]
      }
    },
    
    groc: {
      markdown: [
         "README.md"
      ],
      coffeescript: [
         "assets/scripts/*.coffee",
         "assets/scripts/**/*.coffee"
      ],
      javascript: [
      ],
      stylesheet: [
         "assets/styles/*.scss",
         "assets/styles/**/*.scss"
      ],
      options: {
        "out": "assets/doc/",
        "strip": "assets/",
        "index": "README.md",
        'index-page-title': "BambooJS Documentation"
      }
    },

    coffee: {
      dev: {
        options:{
          bare:true
        },
        files: [
          {
            expand: true,
            cwd: 'assets/scripts/',
            src: ['**/*.coffee'],
            dest: 'www/scripts/',
            ext: '.js'
          }
        ]
      }
    },

    concat: {
      js: {
        src: jsFilesToInject,
        dest: 'www/concat/production.js'
      },
      css: {
        src: cssFilesToInject,
        dest: 'www/concat/production.css'
      }
    },

    uglify: {
      dist: {
        src: ['www/concat/production.js'],
        dest: 'www/min/production.js'
      }
    },

    cssmin: {
      dist: {
        src: ['www/concat/production.css'],
        dest: 'www/min/production.css'
      }
    },

    'sails-linker': {

      devJs: {
        options: {
          startTag: '<!--SCRIPTS-->',
          endTag: '<!--SCRIPTS END-->',
          fileTmpl: '<script src="%s"></script>',
          appRoot: 'www/'
        },
        files: {
          'www/**/*.html': jsFilesToInject
        }
      },

      prodJs: {
        options: {
          startTag: '<!--SCRIPTS-->',
          endTag: '<!--SCRIPTS END-->',
          fileTmpl: '<script src="%s"></script>',
          appRoot: 'www/'
        },
        files: {
          'www/**/*.html': ['www/min/production.js']
        }
      },

      devStyles: {
        options: {
          startTag: '<!--STYLES-->',
          endTag: '<!--STYLES END-->',
          fileTmpl: '<link rel="stylesheet" href="%s">',
          appRoot: 'www/'
        },

        // cssFilesToInject defined up top
        files: {
          'www/**/*.html': cssFilesToInject
        }
      },

      prodStyles: {
        options: {
          startTag: '<!--STYLES-->',
          endTag: '<!--STYLES END-->',
          fileTmpl: '<link rel="stylesheet" href="%s">',
          appRoot: 'www/'
        },
        files: {
          'www/index.html': ['www/min/production.css']
        }
      },

      // Bring in JST template object
      devTpl: {
        options: {
          startTag: '<!--TEMPLATES-->',
          endTag: '<!--TEMPLATES END-->',
          fileTmpl: '<script type="text/javascript" src="%s"></script>',
          appRoot: 'www/'
        },
        files: {
          'www/index.html': ['www/templates.js']
        }
      },
    },

    watch: {
      assets: {

        // Assets to watch:
        files: ['assets/**/*'],

        // When assets are changed:
        tasks: ['compileAssets', 'linkAssets']
      }
    },

    connect: {
      options: {
        port: process.env.PORT || 3131,
        base: 'dist/',
      },

      all: {},
    },

    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      dev: {
        tasks: ["run:phonegap", "watch"]
      }
    },

    run: {
      options: {
        wait: true//false
      },
      phonegap: {
        cmd: 'phonegap',
        args: ['serve', '--no-autoreload', '-p', 3001]
      }
    }

  });

  //require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.registerTask('server', [
    'compileAssets',
    'linkAssets',
    'concurrent:dev',
  ]);

  // When Sails is lifted:
  grunt.registerTask('default', ['server']);

  grunt.registerTask('compileAssets', [
    'clean:dev',
    'copy:reload',
    'jst:dev',
    'eco:dev',
    'less:dev',
    'sass:dev',
    'coffee:dev',
    'copy:dev'  
  ]);

  grunt.registerTask('linkAssets', [

    // Update link/script/template references in `assets` index.html
    'sails-linker:devJs',
    'sails-linker:devStyles',
    'sails-linker:devTpl'
  ]);


  // Build the assets into a web accessible folder.
  // (handy for phone gap apps, chrome extensions, etc.)
  grunt.registerTask('build', [
    'compileAssets',
    'linkAssets',
    'clean:build',
    'copy:build'
  ]);

  // When sails is lifted in production
  grunt.registerTask('prod', [
    'clean:dev',
    'eco:dev',
    'jst:dev',
    'less:dev',
    'sass:dev',
    'copy:dev',
    'coffee:dev',
    'concat',
    'uglify',
    'cssmin',
    'sails-linker:prodJs',
    'sails-linker:prodStyles',
    'sails-linker:devTpl'
  ]);

  grunt.registerTask('doc', ['groc']);

  // When API files are changed:
  // grunt.event.on('watch', function(action, filepath) {
  //   grunt.log.writeln(filepath + ' has ' + action);

  //   // Send a request to a development-only endpoint on the server
  //   // which will reuptake the file that was changed.
  //   var baseurl = grunt.option('baseurl');
  //   var gruntSignalRoute = grunt.option('signalpath');
  //   var url = baseurl + gruntSignalRoute + '?action=' + action + '&filepath=' + filepath;

  //   require('http').get(url)
  //   .on('error', function(e) {
  //     console.error(filepath + ' has ' + action + ', but could not signal the Sails.js server: ' + e.message);
  //   });
  // });
};
