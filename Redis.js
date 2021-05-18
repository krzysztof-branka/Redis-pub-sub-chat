function Redis(username) {

	const host = 'localhost';
	const port = 6379;
	let currentChat = null;
	let chatType = null;
	let onMessage = (channel, message)=>{};
	let onUsersUpdate = (users) => {};
	let keepActiveInterval;

	const publisher = redis.createClient({host, port});
	const subscriber = redis.createClient({host, port});
	const client = redis.createClient({host, port});
	
	publisher.on('error', err => {
		console.log('Publisher error ' + err);
	});

	subscriber.on('error', err => {
		console.log('Subscriber error ' + err);
	});

	subscriber.on('message', (channel, message)=>{ onMessage(channel, message, null)});
	subscriber.on('pmessage', (pattern ,channel, message)=>{onMessage(channel, message, pattern)});

	const getActiveUsers = () => {
		const scanner = new redisScan(client);
		scanner.scan("users:*", (err, users) => {
			if (err) throw(err);
			const currentChatUsers = users.filter((userEntry)=>{
				if(userEntry.split(':')[1] === currentChat) return true;
				return false
			})
			onUsersUpdate(currentChatUsers, users);
		});
	}


	getActiveUsers();
	getActiveUsersInterval = setInterval(getActiveUsers, 10000);

	const joinChat = (chat, type) => {
		if(currentChat) leaveChat();
		currentChat = chat;
		chatType = type;
		if(type === "single") subscriber.subscribe(chat);
		else if (type === "all-chat") subscriber.psubscribe('*');
		else if (type === "pattern") subscriber.psubscribe(chat);

		if(currentChat)	client.setex("users:"+currentChat+":"+username, 60, "active");
		keepActiveInterval = setInterval(()=>{
			if(currentChat)	client.setex("users:"+currentChat+":"+username, 60, "active");
		},50000)
		getActiveUsers();
	}

	const leaveChat = () =>{
		client.del("users:"+currentChat+":"+username)
		subscriber.unsubscribe();
		subscriber.punsubscribe("*", 0);
		subscriber.punsubscribe(currentChat, 0);
		currentChat = null;
		clearInterval(keepActiveInterval);
		getActiveUsers()
	}

	const publish = (message) => {
		if(chatType === "pattern") return;
		if(chatType === "all-chat") return publisher.publish("all-chat", username+": "+message);
		publisher.publish(currentChat, username+": "+message);
	}

	const setOnMessage = (callback) => {
		onMessage = callback;
	}
	const setOnUsersUpdate = (callback) => {
		onUsersUpdate = callback;
	}

	const getFriends= async () => {
		const lrangeAsync = promisify(client.lrange).bind(client);
		const friends = await lrangeAsync("friends:"+username, 0, -1);
		return friends?friends:[];
	}

	const addFriend = async (friendName) => {
		const currentFriends = await getFriends();
		if(currentFriends.some((friend)=>{ return friendName === friend})) return currentFriends;
		client.rpush("friends:"+username, friendName);
		return getFriends();
	}

	const removeFriend = async (friendName) => {
		client.lrem("friends:"+username,0,friendName);
		return getFriends();
	}

	return {
		joinChat,
		leaveChat,
		publish,
		setOnMessage,
		setOnUsersUpdate,
		addFriend,
		removeFriend,
		getFriends
	}

}