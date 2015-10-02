class Momo

  manifest:
    meta:
      manifestUrl: "index.json"

  contructor: (args...) ->
    @bindEvents()


  bindEvents: ->
    # Navigation Handler
    xindow.addEventListener "hashchange", @onHashChange, false
    document.addEventListener "deviceready", @onDeviceReady, false

  init: ->
    @initFileSystem()
    @initIndex()
    @backupAssets()
    @loadLocalManifest()
    @checkForUpdate(app.start, app.start)
    @updateTimeout = setTimeout( app.checkForLastUpdateCheck, app.manifest.meta.updateFreq )

  initFileSystem: ->


    FastClick.attach(document.body)

  start: ->
    @loadManifest()
  
  loadManifest: ->
    manifest = JSON.parse

  update: ->

  updateAvailable: (y, n, f) ->

    
