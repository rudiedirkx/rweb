// Source:  https://github.com/rudiedirkx/Auto-indent
// Version: e51ca530fb557806b81539ba9dbe34f5348ccf4e

/**
 * To do:
 * - tab/shift tab: (un)indent a line on command
 * - 'mass tab': select several lines and (un)indent them all (requires TAB)
 * - support for undo/redo, by using `execCommand('insertText')`
 */

function doAutoIndent(ta, indent, delimiters) {
	indent || (indent = "\t");
	delimiters || (delimiters = ['{}', '[]', '()']);

	function setValue(text) {
		ta.value = text;
		return ta.value;
	}

	function str_repeat(str, n) {
		var out = '';
		while (n--) out += str;
		return out;
	}

	function isIndented(line) {
		var regex = new RegExp('^(' + indent + '+)', 'g');
		var match = line.match(regex);
		return match && match[0].length / indent.length || 0;
	}

	function addIndent(before, after, num) {
		// num = num ? ~~num : 1;
		if ( !num ) return;
		ta._lastValue = setValue(before + str_repeat(indent, num) + after);
		ta.selectionStart = ta.selectionEnd = before.length + indent.length * num;
	}

	function removeIndent(before, after, delim) {
		var remove = before.slice(before.length - 1 - indent.length, before.length - 1);
		if ( remove != indent ) {
			return;
		}

		ta._lastValue = setValue(before.slice(0, -1-indent.length) + delim + after);
		ta.selectionStart = ta.selectionEnd = before.length - indent.length;
	}

	function getPrevLine(before) {
		var lines = ta.value.split(/\n/g);
		var line = before.trimRight().split(/\n/g).length - 1;
		return lines[line] || '';
	}

	function isStartingDelim(char) {
		for (var i=0; i<delimiters.length; i++) {
			var delim = delimiters[i];
			if (delim[0] == char) {
				return i;
			}
		}
		return -1;
	}

	function isEndingDelim(char) {
		for (var i=0; i<delimiters.length; i++) {
			var delim = delimiters[i];
			if (delim[1] == char) {
				return i;
			}
		}
		return -1;
	}

	function onKeyUp(e) {
		var lastValue = ta._lastValue === undefined ? ta.defaultValue : ta._lastValue;
		var change = ta.value.length - lastValue.length;
		ta._lastValue = ta.value;
		if ( !change ) {
			return;
		}

		var caret = ta.selectionStart;
		var added = change > 0 && ta.value.substr(caret - change, change) || '';
		var removed = change < 0 && lastValue.substr(caret, -change) || '';

		var code = e.keyCode;
		var value = ta.value;
		var before = value.substr(0, caret);
		var after = value.substr(caret);
		var lastChar = before.trim().slice(-1);
		var nextChar = after.substr(0, 1);
		var delim;

		// ENTER
		if ( code == 13 ) {
			// Immediately after a {
			if ( isStartingDelim(lastChar) >= 0 ) {
				var prevLine = getPrevLine(before);
				var indents = isIndented(prevLine);
				var more = isEndingDelim(nextChar) >= 0 ? 0 : 1;
				return addIndent(before, after, indents + more);
			}

			// After an indented line
			var prevLine = getPrevLine(before);
			var indents = isIndented(prevLine);
			var more = isEndingDelim(nextChar) >= 0 ? -1 : 0;
			if ( indents + more > 0 ) {
				addIndent(before, after, indents + more);
			}
		}
		else if ( (delim = isEndingDelim(added)) >= 0 ) {
			removeIndent(before, after, delimiters[delim][1]);
		}
	}

	ta.addEventListener('keyup', onKeyUp, false);
}
