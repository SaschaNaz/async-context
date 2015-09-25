declare var run: HTMLInputElement;
declare var cancel: HTMLInputElement;

import AsyncContext = AsyncChainer.AsyncContext;
import AsyncFeed = AsyncChainer.AsyncFeed;
import Contract = AsyncChainer.Contract;

function delayedLogger() {
	return new AsyncContext<void>((context) => {
		setTimeout(() => {
			context.resolve();
		}, 10000);
	}).feed();
}

function waitEvent(element: EventTarget, eventName: string) {
	let callback: () => any;
	return new AsyncFeed((resolve, reject) => {
		callback = () => resolve();
		element.addEventListener(eventName, callback);
	}, { 
		revert: () => element.removeEventListener(eventName, callback)
	});
}

waitEvent(document, "DOMContentLoaded").then(() => {
	alert("DOMContentLOADED!");
});