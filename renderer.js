window.addEventListener('DOMContentLoaded', () => {

	const loginView = document.querySelector('#login-view');
	const chatsView = document.querySelector('#chats-view');
	const loginForm = document.querySelector('#login-form');
	const usernameInput = document.querySelector('#username');

	//Chat view elements
	const chatSubmit = document.querySelector('#chat-submit');
	const chatInput = document.querySelector('#chat-input');
	const chatOutput = document.querySelector('#chat-output');
	const chatInfo = document.querySelector('#chat-info');

	const usersDiv = document.querySelector('.people .users');
	const friendsDiv = document.querySelector('.people .friends');

	const addFriendInput = document.querySelector('#add-friend');
	const addFriendForm = document.querySelector('#add-friend-form');


	let username = '';
	let redis;
	let lastActive = {};
	let friends = [];

	//Init chat view
	loginForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		username = usernameInput.value;
		loginView.classList.remove('active');
		chatsView.classList.add('active');
		redis = Redis(username);
		redis.setOnMessage((channel, message, pattern) => {
			if (pattern) chatOutput.innerHTML += `(${channel}) ${message}</br>`;
			else chatOutput.innerHTML += `${message}</br>`;
		})

		chatInfo.innerHTML = `<div>Username: ${username}</div><div>Chat: None</div>`;

		//Handle user friends
		const updateFriends = (friends) => {
			if(!Array.isArray(friends)) friends = [];
			friendsDiv.innerHTML = '';
			friends.forEach((friend) => {
				friendsDiv.innerHTML += `<div data-friend-name="${friend}" class="friend${lastActive[friend] ? ' active' : ''}">${friend}${lastActive[friend] ? ' ('+lastActive[friend]+')' : ''}</div>`;
			})

			const friendsElements = [...document.querySelectorAll('.friend[data-friend-name]')];
			friendsElements.forEach((friend)=>{
				friend.addEventListener('click', async (e)=>{
					const friendName = e.target.dataset.friendName;
					updateFriends(await redis.removeFriend(friendName));
				})
			})

		}

		//Update channels active users
		redis.setOnUsersUpdate((currentChatUsers, allUsers) => {
			const channels = {};
			usersDiv.innerHTML = '';
			currentChatUsers.forEach((userEntry) => {
				const [s, c, user] = userEntry.split(':');
				usersDiv.innerHTML += `<div class="user">${user}</div>`
			})
			lastActive = {};
			allUsers.forEach((userEntry) => {
				const [_, channel, user] = userEntry.split(':');
				lastActive[user] = channel;
				if (channels[channel]) channels[channel]++;
				else channels[channel] = 1;
			})

			const chatJoinButtons = [...document.querySelectorAll('.chats [data-chat-id]')];
			chatJoinButtons.forEach(chatButton => {
				if (chatButton.dataset.chatType === "single" || chatButton.dataset.chatType === "all-chat") {
					const chatId = chatButton.dataset.chatId;
					if (channels[chatId]) chatButton.querySelector('.chat-picker-active').innerHTML = `(${channels[chatId]})`;
					else chatButton.querySelector('.chat-picker-active').innerHTML = `(0)`;
				}
			});
			updateFriends(friends);
		})


		friends = await redis.getFriends()
		updateFriends(friends);

		addFriendForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			friends = await redis.addFriend(addFriendInput.value);
			updateFriends(friends);
		})

	})


	const joinChatAnchors = [...document.querySelectorAll('.chats [data-chat-id]')]
	joinChatAnchors.forEach((chatButton) => {
		const chatName = chatButton.querySelector('.chat-picker-name').innerText;
		chatButton.addEventListener('click', (e) => {
			e.preventDefault();
			chatOutput.innerHTML = '';
			chatInfo.innerHTML = chatInfo.innerHTML = `<div>Username: ${username}</div><div>Chat: ${chatName}</div>`;
			redis.joinChat(chatButton.dataset.chatId, chatButton.dataset.chatType);
		})
	})

	chatSubmit.addEventListener('submit', (e) => {
		e.preventDefault();
		redis.publish(chatInput.value);
		chatInput.value = '';
	})


})