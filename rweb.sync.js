rweb.sync = {

	import: function(newSites, callback, options) {
		var summary = {
			imported: false,
			changes: 0,
		};

		newSites = newSites.filter(rweb.siteFilter);
		if ( newSites.length ) {
			rweb.sitesByUUID(function(existingSites) {
				var add = [];
				var update = [];
				var orphans = Object.keys(existingSites);
				var unchanged = [];
				newSites.forEach(function(site) {
					// ADD
					if ( !site.id || !existingSites[site.id] ) {
						if ( !site.id ) {
							site.id = rweb.uuid();
						}
						if ( site.enabled == null ) {
							site.enabled = true;
						}
						add.push(site);
						return;
					}

					// ORPHAN
					var i = orphans.indexOf(site.id);
					if ( i >= 0 ) {
						orphans.splice(i, 1);
					}

					// UPDATE
					var oldSite = rweb.unify(existingSites[site.id]);
					var newSite = rweb.unify(site);
					if ( !rweb.equal(oldSite, newSite) ) {
						// Changed
						var enabled = existingSites[site.id].enabled;
						existingSites[site.id] = site;
						existingSites[site.id].enabled = enabled;
						update.push(site.host);
					}
					else {
						// Not changed
						unchanged.push(site.host);
					}
				});

				// Print detailed log before asking confirmation
				console.log("\n\n==== IMPORT LOG ====");
				console.log("NEW TO ADD:\n - " + add.map(function(site) {
					return site.host;
				}).join("\n - "));
				console.log("LOCAL TO UPDATE:\n - " + update.join("\n - "));
				console.log("LOCAL UNCHANGED:\n - " + unchanged.join("\n - "));
				console.log("LOCAL " + (options.delete ? "TO DELETE" : "ORPHANS") + ":\n - " + orphans.map(function(uuid) {
					return existingSites[uuid].host;
				}).join("\n - "));
				console.log("==== IMPORT LOG ====\n\n");

				// DELETE
				if ( options.delete ) {
					orphans.forEach(function(uuid) {
						delete existingSites[uuid];
					});
				}

				// Summarize & confirm
				summary.changes = add.length + update.length + (options.delete ? orphans.length : 0);
				var message = [
					"Import summary:",
					([
						newSites.length + " sites ready to import",
						add.length + " sites will be added",
						update.length + " sites will be updated",
						unchanged.length + " sites will be unchanged",
						(
							options.delete ?
							orphans.length + " sites will be deleted" :
							orphans.length + " sites exist locally and not in import"
						),
					]).join("\n"),
					"(the console contains a more detailed log)",
					"Do you agree?",
				];
				if ( options.silent || confirm(message.join("\n\n")) ) {
					// Add new
					add.forEach(function(site) {
						existingSites[site.id] = site;
					});

					// Convert to array and save
					var list = [];
					for ( var uuid in existingSites ) {
						if ( existingSites.hasOwnProperty(uuid) ) {
							list.push(existingSites[uuid]);
						}
					}

					// Save array
					rweb.saveSites(list, function() {
						summary.imported = true;
						callback(summary);
					});
					return;
				}

				callback(summary);
			});
			return;
		}

		callback(summary);
	},

	connect: function(interactive, callback) {
		chrome.identity.getAuthToken({interactive: interactive}, function(token) {
			if ( token ) {
				callback(token);
			}
			else {
				console.warn("chrome.identity.getAuthToken() didn't return a token!", chrome.runtime.lastError);

				callback(false);
			}
		});
	},
	download: function(callback, silent) {
		var handler = function(sites) {
			console.log('Downloaded sites', sites);

			rweb.sync.import(sites, function(summary) {
				// Remove `downloadingSince` to enable new downloads
				chrome.storage.local.remove(['downloadingSince']);

				if ( summary.imported ) {
					chrome.storage.local.set({lastDownload: Date.now(), dirty: false}, function() {
						console.log('Saved `lastDownload`.');
						callback(summary);
					});
				}
				else {
					callback(summary);
				}
			}, {
				"silent": Boolean(silent),
				"delete": true,
			});
		};

		rweb.sync.connect(false, function(token) {
			// Save `downloadingSince` to avoid multi-downloading
			chrome.storage.local.set({downloadingSince: Date.now()});

			rweb.sync.drive.list(token, function(rsp) {
				// File exists, download data
				if ( rsp.items.length ) {
					var file = rsp.items[0];
					rweb.sync.drive.download(token, file, function(data) {
						// Usable data
						if ( data ) {
							handler(data);
						}
						// No data, or corrupt
						else {
							rweb.sync.drive.upload(token, file.id, function(data) {
								handler(data);
							});
						}
					});
				}
				// File doesn't exist, create and upload
				else {
					rweb.sync.drive.create(token, function(file) {
						rweb.sync.drive.upload(token, file.id, function(data) {
							handler(data);
						});
					});
				}
			}); // drive.list()
		}); // connect()
	},
	upload: function(callback, silent) {
		var summary = {
			dirty: false,
		};

		var start = function() {
			rweb.sync.connect(false, function(token) {
				rweb.sync.drive.list(token, function(rsp) {
					// File exists, overwrite
					if ( rsp.items.length ) {
						var file = rsp.items[0];
						upload(token, file);
					}
					// File doesn't exist, create & upload
					else {
						rweb.sync.drive.create(token, function(file) {
							upload(token, file);
						});
					}
				}); // drive.list()
			}); // connect()
		};

		var upload = function(token, file) {
			rweb.sync.drive.upload(token, file.id, function(data) {
				chrome.storage.local.set({lastUpload: Date.now(), lastDownload: Date.now()}, function() {
					console.log('Saved `lastUpload` and `lastDownload`.');
					callback(summary);
				});
			});
		};

		chrome.storage.local.get('dirty', function(items) {
			summary.dirty = Boolean(items.dirty == null || items.dirty);

			// Manual upload, always. Auto upload, only if dirty
			if ( !silent || summary.dirty ) {
				start();
			}
			else {
				console.log('Not auto-uploading, because local state is clean');
			}
		});
	},
	drive: {
		wrapLoad: function(type, body) {
			return function(e) {
				var status = parseFloat(this.getResponseHeader('status'));
console.debug(type + ':status', status);

				// Unauthorized
				if ( status == 401 ) {
					rweb.sync.connect(false, function(token) {
						chrome.identity.removeCachedAuthToken({token: token}, function() {
							alert("Authentication error during '" + type + "'. Try again after this reload.");
							location.reload();
						});
					});
				}
				// Success
				else if ( status >= 200 && status < 400 ) {
					body.call(this, e);
				}
				// Any error
				else {
					console.error('RESPONSE:', this.responseText);
					// alert("Unrecoverable error during '" + type + "'. Check console for details.");
				}
			};
		},
		wrapCallback: function(type, callback) {
			return rweb.sync.drive.wrapLoad(type, function(e) {
console.debug(type + ':load', this, e);
				var rsp = JSON.parse(this.responseText);
console.debug(type + ':data', rsp);
				callback(rsp);
			});
		},
		wrapError: function(type) {
			return function(e) {
				console.warn(type + ':error', this, e);
				// alert('There was an error connecting to Drive. Check the console.');
			};
		},
		list: function(token, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('GET', 'https://www.googleapis.com/drive/v2/files', true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.onload = rweb.sync.drive.wrapCallback('list', callback);
			xhr.onerror = rweb.sync.drive.wrapError('list');
			xhr.send();
		},
		create: function(token, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('POST', 'https://www.googleapis.com/drive/v2/files', true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.sync.drive.wrapCallback('create', callback);
			xhr.onerror = rweb.sync.drive.wrapError('create');

			var data = {
				"title": "rweb.sites.json",
				"mimeType": "text/json",
				"description": "All RWeb configured sites for " + chrome.runtime.id,
			};
			xhr.send(JSON.stringify(data));
		},
		upload: function(token, fileId, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('PUT', 'https://www.googleapis.com/upload/drive/v2/files/' + fileId, true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.sync.drive.wrapCallback('upload', function(rsp) {
				chrome.storage.local.set({dirty: false}, function() {
					callback(rsp);
				});
			});
			xhr.onerror = rweb.sync.drive.wrapError('upload');

			chrome.storage.local.get(['sites'], function(items) {
				var sites = items.sites || [];
console.debug('upload:output', sites);
				xhr.send(JSON.stringify(sites));
			});
		},
		download: function(token, file, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('GET', file.downloadUrl, true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.onload = rweb.sync.drive.wrapLoad('download', function(e) {
console.debug('download:load', this, e);
				if ( !this.responseText ) {
					return callback(false);
				}

				try {
					var data = JSON.parse(this.responseText);
					callback(data);
				}
				catch (ex) {
					return callback(false);
				}
			});
			xhr.onerror = rweb.sync.drive.wrapError('download');
			xhr.send();
		}
	}
};
