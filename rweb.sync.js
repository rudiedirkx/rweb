
rweb.identity && (rweb.sync = {

	// @todo Fix Drive CORS!? Chrome doesn't have a problem, but Firefox won't accept any Drive resources

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

	connect: async function(interactive, callback) {
		// Chrome
		if ( rweb.browser.identity.getAuthToken ) {
			var token;
			try {
				token = await rweb.browser.identity.getAuthToken({interactive});
				token = token.token;
			}
			catch (ex) {
				console.log(ex);
			}

			if ( token ) {
				callback(token);
			}
			else {
				// console.warn("rweb.browser.identity.getAuthToken() didn't return a token!", rweb.browser.runtime.lastError);

				callback(false);
			}
			return token;
		}

		// WebExtensions (Firefox)
		var manifest = rweb.browser.runtime.getManifest();
		var provider = 'https://accounts.google.com/o/oauth2/v2/auth';
		var clientId = encodeURIComponent(manifest.oauth2.client_id);
		var state = encodeURIComponent(Math.random());
		var scopes = encodeURIComponent(manifest.oauth2.scopes.join(' '));
		var redirectUrl = encodeURIComponent(rweb.browser.identity.getRedirectURL());
		var url = `${provider}?client_id=${clientId}&state=${state}&response_type=token&scope=${scopes}&redirect_uri=${redirectUrl}`;
console.debug('oauth2 url', url);
		rweb.browser.identity.launchWebAuthFlow({
			url: url,
			interactive: interactive,
		}).then(function(url) {
			url = new URL(url.replace(/#/g, '?'));
			var token = url.searchParams.get('access_token');
console.log('auth access_token', token)
			if ( token ) {
				// return rweb.browser.storage.local.set({drive_access_token: token}, function() {
					return callback(token);
				// });
			}

			throw new Error("Can't find `access_token` in response URL");
		}).catch(function() {
console.log(`${interactive?'':'non-'}interactive auth failed`);
			callback(false);
		});
	},
	download: function(callback, silent) {
		var handler = function(sites) {
			console.log('Downloaded sites', sites);

			rweb.sync.import(sites, function(summary) {
				// Remove `downloadingSince` to enable new downloads
				rweb.browser.storage.local.remove(['downloadingSince']);

				if ( summary.imported ) {
					rweb.browser.storage.local.set({lastDownload: Date.now(), dirty: false}, function() {
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
			if (!token) {
				return callback({imported: false, unconnected: true});
			}

			// Save `downloadingSince` to avoid multi-downloading
			rweb.browser.storage.local.set({downloadingSince: Date.now()});

			rweb.sync.drive.list(token, function(file) {
				// File exists, download data
				if ( file ) {
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
					rweb.sync.drive.createFile(token, function(file) {
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
				rweb.sync.drive.list(token, function(file) {
					// File exists, overwrite
					if ( file ) {
						upload(token, file);
					}
					// File doesn't exist, create & upload
					else {
						rweb.sync.drive.createFile(token, function(file) {
							upload(token, file);
						});
					}
				}); // drive.list()
			}); // connect()
		};

		var upload = function(token, file) {
			rweb.sync.drive.upload(token, file.id, function(data) {
				rweb.browser.storage.local.set({lastUpload: Date.now(), lastDownload: Date.now()}, function() {
					console.log('Saved `lastUpload` and `lastDownload`.');
					callback(summary);
				});
			});
		};

		rweb.browser.storage.local.get('dirty', function(items) {
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
console.debug(type + ':status', this.status + ' ' + this.statusText);

				// Unauthorized
				if ( this.status == 401 ) {
					rweb.sync.connect(false, function(token) {
						rweb.browser.identity.removeCachedAuthToken({token: token}, function() {
							alert("Authentication error during '" + type + "'. Reload page and try again.");
							// location.reload(true);
						});
					});
				}
				// Success
				else if ( this.status >= 200 && this.status < 400 ) {
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
		headers: function(token, more = {}) {
			return {
				...more,
				"Authorization": 'Bearer ' + token,
			};
		},
		list: async function(token, callback) {
			const rsp = await fetch(new Request('https://www.googleapis.com/drive/v2/files', {
				method: 'GET',
				headers: rweb.sync.drive.headers(token),
			}));
			const data = await rsp.json();
			const file = data.items.find(file => file.mimeType == 'application/json');

			// Immediately go on with processing
			callback(file);

			// @todo Doesn't work very well in Firefox, and breaks (drive:list) in unpatched versions
			// See if the RWeb file is in its own folder yet, or move it
			// setTimeout(function() {
			// 	rweb.sync.drive.moveToFolder(token, file);
			// }, 1000);
		},
		moveToFolder: function(token, file) {
			if ( file && file.parents.length == 1 && file.parents[0].isRoot ) {
				console.debug('[RWeb folder] Creating custom folder for RWeb file...');
				var oldParent = file.parents[0];
				rweb.sync.drive.createFolder(token, function(newParent) {
					console.debug('[RWeb folder] Updating RWeb file parents...');

					var query = new URLSearchParams;
					query.set('addParents', newParent.id);
					query.set('removeParents', oldParent.id);

					rweb.sync.drive.patch(token, file.id, query, function(file) {
						console.debug('[RWeb folder] Moved rweb file to its own folder!');
					});
				});
			}
		},
		createFolder: function(token, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('POST', 'https://www.googleapis.com/drive/v2/files', true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.sync.drive.wrapCallback('createFolder', callback);
			xhr.onerror = rweb.sync.drive.wrapError('createFolder');

			var data = {
				"title": 'RWeb (' + rweb.browser.runtime.id + ')',
				"mimeType": 'application/vnd.google-apps.folder',
			};
			xhr.send(JSON.stringify(data));
		},
		patch: function(token, fileId, query, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('PATCH', 'https://www.googleapis.com/drive/v2/files/' + fileId + '?' + query, true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.sync.drive.wrapCallback('patch', callback);
			xhr.onerror = rweb.sync.drive.wrapError('patch');
			xhr.send('{}');
		},
		createFile: function(token, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('POST', 'https://www.googleapis.com/drive/v2/files', true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.sync.drive.wrapCallback('createFile', callback);
			xhr.onerror = rweb.sync.drive.wrapError('createFile');

			var data = {
				"title": "rweb.sites.json",
				"mimeType": "text/json",
				"description": "All RWeb configured sites for " + rweb.browser.runtime.id,
			};
			xhr.send(JSON.stringify(data));
		},
		upload: async function(token, fileId, callback) {
			const items = await rweb.browser.storage.local.get(['sites']);

			const sites = items.sites || [];
console.debug('upload:output', sites);

			const rsp = await fetch(new Request('https://www.googleapis.com/upload/drive/v2/files/' + fileId, {
				method: 'PUT',
				headers: rweb.sync.drive.headers(token, {
					"Content-Type": 'application/json',
				}),
				body: JSON.stringify(sites),
			}));

			await rweb.browser.storage.local.set({dirty: false});
			callback(sites);
		},
		download: async function(token, file, callback) {
			const rsp = await fetch(new Request(file.downloadUrl, {
				method: 'GET',
				headers: rweb.sync.drive.headers(token),
			}));
			const json = await rsp.text();
			var data = JSON.parse(json);
			callback(data);
		}
	}
});
