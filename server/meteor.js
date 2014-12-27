/*
packages
{ name: 'lokvin:errors',
  maintainers: [Object],
  lastUpdated: Fri Dec 26 2014 15:33:06 GMT+0100 (CET),
  _id: 'Ew6dnvztFt7pk4BSq'
},

versions
{ _id: 'mbQKaSjpeXfSyim48',
  compilerVersion: 'meteor/15',
  containsPlugins: true,
  debugOnly: false,
  dependencies: { meteor: [Object] },
  description: 'just for test',
  earliestCompatibleVersion: '1.0.0',
  ecRecordFormat: '1.0',
  git: 'https://github.com/acemtp/meteor-csm.git',
  lastUpdated: Fri Dec 26 2014 15:41:41 GMT+0100 (CET),
  longDescription: null,
  packageName: 'acemtp:test',
  published: Fri Dec 26 2014 15:36:08 GMT+0100 (CET),
  publishedBy: { username: 'acemtp', id: 'oeMmRb6pC6n9H3DHL' },
  releaseName: 'METEOR@1.0.2.1',
  source:
   { url: 'https://warehouse.meteor.com/sources/oeMmRb6pC6n9H3DHL/1419604567309/2DC5kW2nBw/acemtp:test-1.0.3-source.tgz',
     tarballHash: 'FyF+5YFaoBce9Jv7IUlRirXDDhO9dsHPcI4VBcnvAao=',
     treeHash: '2c56EvdbXy9hjM3iAjHkM9msWVpWA8AWZ82mfevWpCI=' },
  unmigrated: true,
  version: '1.0.3'
}

builds
{ buildArchitectures: 'os+web.browser+web.cordova',
  builtBy: { username: 'acemtp', id: 'oeMmRb6pC6n9H3DHL' },
  build:
   { url: 'https://warehouse.meteor.com/builds/dBXwPW8deP8e78hY7/1419604568422/PAStFT5CzE/acemtp:test-1.0.3-os+web.browser+web.cordova.tgz',
     tarballHash: 'FUPcvllUqLpx39TsvoGx9sx/mhz6HByhRv/bbaNN84U=',
     treeHash: 'cCOzX35rgeZUNZ22GkjSIJPtHClWbyCbnySdXVQtzmw=' },
  versionId: 'mbQKaSjpeXfSyim48',
  lastUpdated: Fri Dec 26 2014 15:36:09 GMT+0100 (CET),
  _id: 'wWEokw6P2oZBYP9Da',
  buildPublished: Fri Dec 26 2014 15:36:09 GMT+0100 (CET)
}
*/

var SyncTokens = new Mongo.Collection('syncTokens');

var count = 1;
var remote;
/*
syncToken = { lastDeletion: 1409018311766,
  format: '1.0',
  packages: 1419604567187,
  versions: 1419604568239,
  builds: 1419604569035,
  releaseTracks: 1419141755611,
  releaseVersions: 1419298444109 
};
*/

packageRequest = function (cb) {
  remote.call('syncNewPackageData', _.omit(SyncTokens.findOne(), '_id') || {}, {/* shortPagesForTest: true */}, function (err, res) {
//    console.log('  Page', count++, SyncTokens.findOne());
    if (err) return console.log('error', err);
    if (!res) return console.log('no result');
    if(res.syncToken)
      SyncTokens.update('syncTokens', _.extend(res.syncToken || {}, { _id: 'syncTokens'} ), { upsert: true });
/*
console.log('col', res.collections);
console.log('pa', res.collections.packages);
console.log('ver', res.collections.versions);
console.log('build', res.collections.builds);
console.log('ret', res.collections.releaseTracks);
console.log('rev', res.collections.releaseVersions);
*/
    if(res.resetData) {
      console.log('  Meteor asks me to reset data');
      Packages.update({}, { $unset: { meteor: '' } }, { multi: true });

      algoliaReset();

//      Packages.remove({});
    } else {
//      console.log('no reset data');
    }

    _.each(res.collections.packages, function(p) {
//      console.log('  package', p._id, p.name);
      var cp = Packages.findOne({ 'meteor.package.name': p.name });
      if(cp) {
        console.log('Update package', p.name);
        try {
          Packages.update(cp._id, { $set: { updateAlgolia: true, 'meteor.package': p } });
        } catch(e) {
          console.error('ERROR update package', cp, p, e);
        }
      } else {
        console.log('New package', p.name);
        try {
          Packages.insert({ updateAlgolia: true, meteor: { package: p } });
        } catch(e) {
          console.error('ERROR insert package', p, e);
        }
      }
    });

    _.each(res.collections.versions, function(v) {
//      console.log('  version', p._id, p.name);
      var cp = Packages.findOne({ 'meteor.package.name': v.packageName });
      console.log('New version', v.packageName, v.version);

      // remove dependencies because we don't need it and it generates error with stevezhu:velocity.js
      delete v.dependencies;
      if(cp) {
        if(!cp.meteor.version || semver.gte(v.version, cp.meteor.version.version)) {
//          console.log('  version', v.packageName, cp.meteor.version?cp.meteor.version.version:'0.0.0', v.version);
          try {
            Packages.update(cp._id, { $set: { updateGit: true, updateAlgolia: true, 'meteor.version': v } });
          } catch(e) {
            console.error('ERROR update version', cp, v, e);
          }
        }
      } else {
//        console.log('  No package for this version', v);
        try {
          Packages.insert({ updateAlgolia: true, meteor: { version: v } });
        } catch(e) {
          console.error('ERROR insert version', v, e);
        }
      }
    });

    // Using setImmediate to allow GC to run each time in case there are a LOT of pages
    if (!res.upToDate) setImmediate(Meteor.bindEnvironment(packageRequest.bind(this, cb)));
    else cb();
  });
};

var meteorUpdateInProgress = false;

meteorUpdate = function () {
  if(meteorUpdateInProgress) return console.log('meteorUpdate already in progress');

//  console.log('Get packages from Meteor...');
  count = 1;
  meteorUpdateInProgress = true;
  remote = remote || DDP.connect('http://packages.meteor.com');
  packageRequest(function () {
//    console.log('Done');
//    console.log('final syncToken', SyncTokens.findOne());
    algoliaUpdate(false);
    meteorUpdateInProgress = false;
  });
};
