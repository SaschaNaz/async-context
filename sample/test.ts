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

function waitEvent<T extends Event>(element: EventTarget, eventName: string) {
	let callback: (evt: T) => void;
	return new AsyncFeed((resolve, reject) => {
		callback = () => resolve();
		element.addEventListener(eventName, callback);
	}, { 
		revert: () => element.removeEventListener(eventName, callback)
	});
}

function subscribeEvent<T extends Event>(element: EventTarget, eventName: string, listener: () => any) {
	let callback = (evt: T) => listener.call(element, evt, feed);
	var feed = new AsyncFeed((resolve, reject) => {
		element.addEventListener(eventName, callback);
	}, {
		revert: () => element.removeEventListener(eventName, callback)
	});
}

waitEvent(document, "DOMContentLoaded").then(() => {
	alert("DOMContentLOADED!");
	
	let logger: AsyncFeed<void>;
	
});