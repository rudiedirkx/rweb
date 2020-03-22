// https://rudiedirkx.github.io/rjs/build.html#-ifsetor,-getter,-array_intersect,-array_diff,-array_defaultfilter,-string_camel,-string_repeat,-_classlist,-asset_js,-coords2d,-anyevent_lmrclick,-anyevent_touches,-anyevent_pagexy,-anyevent_summary,-anyevent_subject,-event_custom,-_event_custom_mousenterleave,-event_custom_mousewheel,-event_custom_directchange,-eventable_off,-eventable_globalfire,-element_attr2method,-element_attr2method_html,-element_attr2method_text,-element_position,-element_scroll,-windoc_scroll,-domready,-xhr,-xhr_global
// 578d01cb28ac1f83d924519d9cc9d82db7613d1f

(function(W, D) {

	"use strict";

	var html = D.documentElement,
		head = html.getElementsByTagName('head')[0];

	var r = function r(selector) {
		return r.$(selector);
	};

	JSON.encode = JSON.stringify;
	JSON.decode = JSON.parse;
	var cssDisplays = {};
	r.arrayish = function(obj) {
		if ( obj == null ) {
			return false;
		}
		if ( obj instanceof Array ) {
			return true;
		}
		if ( typeof obj.length == 'number' && typeof obj != 'string' && ( obj[0] !== undefined || obj.length === 0 ) ) {
			return true;
		}
		return false;
	};

	r.array = function(list) {
		var arr = [];
		r.each(list, function(el, i) {
			arr.push(el);
		});
		return arr;
	};
	r.class = function(obj) {
		var code = String(obj.constructor);
		return code.match(/ (.+?)[\(\]]/)[1];
	};
	r.is_a = function(obj, type) {
		return W[type] && obj instanceof W[type];
	};
	r.serialize = function(o, prefix) {
		var q = [];
		r.each(o, function(v, k) {
			var name = prefix ? prefix + '[' + k + ']' : k,
			v = o[k];
			if ( typeof v == 'object' ) {
				q.push(r.serialize(v, name));
			}
			else {
				q.push(name + '=' + encodeURIComponent(v));
			}
		});
		return q.join('&');
	};
	r.copy = function(obj) {
		return JSON.parse(JSON.stringify(obj));
	};
	r.merge = function(base) {
		var merger = function(value, name) {
			base[name] = value;
		};
		for ( var i=1, L=arguments.length; i<L; i++ ) {
			r.each(arguments[i], merger);
		}
		return base;
	};
	r.each = function(source, callback, context) {
		if ( r.arrayish(source) ) {
			for ( var i=0, L=source.length; i<L; i++ ) {
				callback.call(context, source[i], i, source);
			}
		}
		else {
			for ( var k in source ) {
				if ( source.hasOwnProperty(k) ) {
					callback.call(context, source[k], k, source);
				}
			}
		}

		return source;
	};

	r.extend = function(Hosts, proto, Super) {
		if ( !(Hosts instanceof Array) ) {
			Hosts = [Hosts];
		}

		r.each(Hosts, function(Host) {
			if ( Super ) {
				Host.prototype = new Super.constructor;
				Host.prototype.constructor = Host;
			}

			var methodOwner = Host.prototype ? Host.prototype : Host;
			r.each(proto, function(fn, name) {
				Object.defineProperty(methodOwner, name, {value: fn});

				if ( Host === Element && !Elements.prototype[name] ) {
					Object.defineProperty(Elements.prototype, name, {value: function() {
						return this.invoke(name, arguments);
					}});
				}
			});
		});
	};

	r.extend(Array, {
		invoke: function(method, args) {
			var results = [];
			this.forEach(function(el) {
				results.push( el[method].apply(el, args) );
			});
			return results;
		},
		contains: function(obj) {
			return this.indexOf(obj) != -1;
		},
		unique: function() {
			var els = [];
			this.forEach(function(el) {
				if ( !els.contains(el) ) {
					els.push(el);
				}
			});
			return els;
		},
		each: Array.prototype.forEach,
		first: function() {
			return this[0];
		},
		last: function() {
			return this[this.length-1];
		}
	});
	var indexOf = [].indexOf;

	function Elements(source, selector) {
		this.length = 0;
		if ( source ) {
			r.each(source, function(el, i) {
				if ( el.nodeType === 1 && ( !selector || el.is(selector) ) ) {
					this.push(el);
				}
			}, this);
		}
	}
	r.extend(Elements, {
		invoke: function(method, args) {
			var returnSelf = false,
				res = [],
				isElements = false;
			r.each(this, function(el, i) {
				var retEl = el[method].apply(el, args);
				res.push( retEl );
				if ( retEl == el ) returnSelf = true;
				if ( retEl instanceof Element ) isElements = true;
			});
			return returnSelf ? this : ( isElements || !res.length ? new Elements(res) : res );
		},
		concat: function(items) {
			return new Elements(this.slice().concat(items));
		},

		filter: function(filter) {
			if ( typeof filter == 'function' ) {
				return new Elements([].filter.call(this, filter));
			}
			return new Elements(this, filter);
		}
	}, new Array);
	function AnyEvent(e) {
		if ( typeof e == 'string' ) {
			this.originalEvent = null;
			e = {"type": e, "target": null};
		}
		else {
			this.originalEvent = e;
		}

		this.type = e.type;
		this.target = e.target || e.srcElement;
		this.relatedTarget = e.relatedTarget;
		this.fromElement = e.fromElement;
		this.toElement = e.toElement;
		this.key = e.keyCode || e.which;
		this.keyName = e.key;
		this.code = e.code;
		this.alt = e.altKey;
		this.ctrl = e.ctrlKey;
		this.shift = e.shiftKey;
		this.button = e.button || e.which;
		this.which = this.key || this.button;
		this.detail = e.detail;

		this.deltaX = e.deltaX;
		this.deltaY = e.deltaY;
		this.deltaZ = e.deltaZ;

		this.pageX = e.pageX;
		this.pageY = e.pageY;
		this.clientX = e.clientX;
		this.clientY = e.clientY;

		this.message = e.message;
		this.data = e.dataTransfer || e.clipboardData;
		this.time = e.timeStamp || e.timestamp || e.time || Date.now();

		this.total = e.total || e.totalSize;
		this.loaded = e.loaded || e.position;
	}
	r.extend(AnyEvent, {
		preventDefault: function(e) {
			if ( e = this.originalEvent ) {
				e.preventDefault();
			}
			this.defaultPrevented = true;
		},
		stopPropagation: function(e) {
			if ( e = this.originalEvent ) {
				e.stopPropagation();
			}
			this.propagationStopped = true;
		},
		stopImmediatePropagation: function(e) {
			this.stopPropagation();

			if ( e = this.originalEvent ) {
				e.stopImmediatePropagation();
			}
			this.immediatePropagationStopped = true;
		}

	});
	Event.Keys = {enter: 13, up: 38, down: 40, left: 37, right: 39, esc: 27, space: 32, backspace: 8, tab: 9, "delete": 46};
	r.each([
		W,
		D,
		Element,
		Elements
	], function(Host) {
		Host.extend = function(methods) {
			r.extend([this], methods);
		};
	});
	var eventablePrototype;
	function Eventable(subject) {
		this.subject = subject;
		this.time = Date.now();
	}
	r.extend(Eventable, eventablePrototype = {
		on: function(eventType, matches, callback) {
			if ( !callback ) {
				callback = matches;
				matches = null;
			}

			var options = {
				bubbles: !!matches,
				subject: this || W
			};

			var eventTypes = eventType instanceof Array ? eventType : [eventType];

			r.each(eventTypes, function(eventType) {
				var baseType = eventType;
				var customEvent;
				var onCallback = function(e, arg2) {
					if ( e && !(e instanceof AnyEvent) ) {
						e = new AnyEvent(e);
					}

					var subject = options.subject;
					if ( e && e.target && matches ) {
						if ( !(subject = e.target.selfOrAncestor(matches)) ) {
							return;
						}
					}

					if ( customEvent && customEvent.filter ) {
						if ( !customEvent.filter.call(subject, e, arg2) ) {
							return;
						}
					}

					return callback.call(subject, e, arg2);
				};

				if ( customEvent && customEvent.before ) {
					if ( customEvent.before.call(this, options) === false ) {
						return;
					}
				}

				var events = options.subject.$events || (options.subject.$events = {});
				events[eventType] || (events[eventType] = []);
				events[eventType].push({
					type: baseType,
					original: callback,
					callback: onCallback,
					bubbles: options.bubbles
				});

				if ( options.subject.addEventListener ) {
					options.subject.addEventListener(baseType, onCallback, options.bubbles);
				}
			}, this);

			return this;
		},
		fire: function(eventType, e, arg2) {
			if ( this.$events && this.$events[eventType] ) {
				if ( !e ) {
					e = new AnyEvent(eventType);
				}
				var immediatePropagationStopped = false;
				r.each(this.$events[eventType], function(listener) {
					if ( !immediatePropagationStopped ) {
						listener.callback.call(this, e, arg2);
						immediatePropagationStopped |= e.immediatePropagationStopped;
					}
				}, this);
			}
			return this;
		}
	});
	var hosts = [W, D, Element, XMLHttpRequest];
	if ( W.XMLHttpRequestUpload ) {
		hosts.push(W.XMLHttpRequestUpload);
	}
	r.extend(hosts, eventablePrototype);
	r.extend(Node, {
		ancestor: function(selector) {
			var el = this;
			while ( (el = el.parentNode) && el != D ) {
				if ( el.is(selector) ) {
					return el;
				}
			}
		},
		getNext: function(selector) {
			if ( !selector ) {
				return this.nextElementSibling;
			}

			var sibl = this;
			while ( (sibl = sibl.nextElementSibling) && !sibl.is(selector) );
			return sibl;
		},
		getPrev: function(selector) {
			if ( !selector ) {
				return this.previousElementSibling;
			}

			var sibl = this;
			while ( (sibl = sibl.previousElementSibling) && !sibl.is(selector) );
			return sibl;
		},
		remove: function() {
			return this.parentNode.removeChild(this);
		},
		getParent: function() {
			return this.parentNode;
		},
		insertAfter: function(el, ref) {
			var next = ref.nextSibling;
			if ( next ) {
				return this.insertBefore(el, next);
			}
			return this.appendChild(el);
		},
		nodeIndex: function() {
			return indexOf.call(this.parentNode.childNodes, this);
		}
	});

	r.extend(D, {
		el: function(tagName, attrs) {
			var el = this.createElement(tagName);
			if ( attrs ) {
				el.attr(attrs);
			}
			return el;
		}
	});
	var EP = Element.prototype;
	r.extend(Element, {
		prop: function(name, value) {
			if ( value !== undefined ) {
				this[name] = value;
				return this;
			}

			return this[name];
		},
		is: EP.matches || EP.matchesSelector || EP.webkitMatchesSelector || EP.mozMatchesSelector || EP.msMatchesSelector || function(selector) {
			return $$(selector).contains(this);
		},
		getValue: function(force) {
			if ( !this.disabled || force ) {
				if ( this.nodeName == 'SELECT' && this.multiple ) {
					return [].reduce.call(this.options, function(values, option) {
						if ( option.selected ) {
							values.push(option.value);
						}
						return values;
					}, []);
				}
				else if ( this.type == 'radio' || this.type == 'checkbox' && !this.checked ) {
					return;
				}
				return this.value;
			}
		},
		toQueryString: function() {
			var els = this.getElements('input[name], select[name], textarea[name]'),
				query = [];
			els.forEach(function(el) {
				var value = el.getValue();
				if ( value instanceof Array ) {
					value.forEach(function(val) {
						query.push(el.name + '=' + encodeURIComponent(val));
					});
				}
				else if ( value != null ) {
					query.push(el.name + '=' + encodeURIComponent(value));
				}
			});
			return query.join('&');
		},
		selfOrAncestor: function(selector) {
			return this.is(selector) ? this : this.ancestor(selector);
		},
		getChildren: function(selector) {
			return new Elements(this.children || this.childNodes, selector);
		},
		getFirst: function() {
			if ( this.firstElementChild !== undefined ) {
				return this.firstElementChild;
			}

			return this.getChildren().first();
		},
		getLast: function() {
			if ( this.lastElementChild !== undefined ) {
				return this.lastElementChild;
			}

			return this.getChildren().last();
		},
		attr: function(name, value, prefix) {
			if ( prefix == null ) {
				prefix = '';
			}
			if ( value === undefined ) {
				if ( typeof name == 'string' ) {
					return this.getAttribute(prefix + name);
				}

				r.each(name, function(value, name) {
					if ( value === null ) {
						this.removeAttribute(prefix + name);
					}
					else {
						this.setAttribute(prefix + name, value);
					}
				}, this);
			}
			else if ( value === null ) {
				this.removeAttribute(prefix + name);
			}
			else {
				if ( typeof value == 'function' ) {
					value = value.call(this, this.getAttribute(prefix + name));
				}

				this.setAttribute(prefix + name, value);
			}

			return this;
		},
		data: function(name, value) {
			return this.attr(name, value, 'data-');
		},
		getHTML: function() {
			return this.innerHTML;
		},
		setHTML: function(html) {
			this.innerHTML = html;
			return this;
		},
		getText: function() {
			return this.innerText || this.textContent;
		},
		setText: function(text) {
			this.textContent = this.innerText = text;
			return this;
		},
		getElement: function(selector) {
			return this.querySelector(selector);
		},

		getElements: function(selector) {
			return $$(this.querySelectorAll(selector));
		},
		getElementsByText: function(text, simple) {
			return this.getElements('*').filter(function(el) {
				if ( simple || el.children.length == 0 ) {
					var tc = simple ? el.textContent.trim() : el.textContent;
					return text instanceof RegExp ? text.test(tc) : tc === text;
				}

				return false;
			});
		},
		getElementByText: function(text, simple) {
			return this.getElementsByText(text, simple)[0];
		},
		removeClass: function(token) {
			this.classList.remove(token);
			return this;
		},
		addClass: function(token) {
			this.classList.add(token);
			return this;
		},
		toggleClass: function(token, add) {
			this.classList.toggle.apply(this.classList, arguments);
			return this;
		},
		replaceClass: function(before, after) {
			return this.removeClass(before).addClass(after);
		},
		hasClass: function(token) {
			return this.classList.contains(token);
		},
		injectBefore: function(ref) {
			ref.parentNode.insertBefore(this, ref);
			return this;
		},
		injectAfter: function(ref) {
			ref.parentNode.insertAfter(this, ref);
			return this;
		},
		inject: function(parent) {
			parent.appendChild(this);
			return this;
		},
		appendTo: function(parent) {
			return this.inject(parent);
		},
		injectTop: function(parent) {
			if ( parent.firstChild ) {
				parent.insertBefore(this, parent.firstChild);
			}
			else {
				parent.appendChild(this);
			}
			return this;
		},
		append: function(child) {
			if ( typeof child == 'string' ) {
				child = D.createTextNode(child);
			}
			this.appendChild(child);
			return this;
		},
		getStyle: function(property) {
			return getComputedStyle(this).getPropertyValue(property);
		},
		css: function(property, value) {
			if ( value === undefined ) {
				if ( typeof property == 'string' ) {
					return this.getStyle(property);
				}

				r.each(property, function(value, name) {
					this.style[name] = value;
				}, this);
				return this;
			}

			this.style[property] = value;
			return this;
		},
		show: function() {
			if ( !cssDisplays[this.nodeName] ) {
				var el = D.el(this.nodeName).inject(this.ownerDocument.body);
				cssDisplays[this.nodeName] = el.getStyle('display');
				el.remove();
			}
			return this.css('display', cssDisplays[this.nodeName]);
		},
		hide: function() {
			return this.css('display', 'none');
		},
		toggle: function(show) {
			if ( show == null ) {
				show = this.getStyle('display') == 'none';
			}

			return show ? this.show() : this.hide();
		},
		empty: function() {
			try {
				this.innerHTML = '';
			}
			catch (ex) {
				while ( this.firstChild ) {
					this.removeChild(this.firstChild);
				}
			}
			return this;
		},
		elementIndex: function() {
			return this.parentNode.getChildren().indexOf(this);
		}
	});

	r.extend(D, {
		getElement: Element.prototype.getElement,
		getElements: Element.prototype.getElements,
		getElementsByText: Element.prototype.getElementsByText,
		getElementByText: Element.prototype.getElementByText
	});

	function $(selector) {
		return D.getElement(selector);
	}

	function $$(selector) {
		return r.arrayish(selector) ? new Elements(selector) : D.getElements(selector);
	}
	r.$ = $;
	W.$ = W.r = r;

	r.$$ = $$;
	W.$$ = $$;
	W.Elements = Elements;
	W.AnyEvent = AnyEvent;
	W.Eventable = Eventable;
})(this, this.document);

