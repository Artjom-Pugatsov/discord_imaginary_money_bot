import { Client,  GatewayIntentBits, MessageType, PermissionsBitField } from "discord.js";
import {CheckUserInServer, CheckUserIsOwner} from "src/ServerValidator";
require("dotenv/config")
import {MoneyRecord} from "./Record"
import { MoneyRecordDatabase } from "./MoneyRecordDatabase";
import { DuelManager } from "./DuelManager";
import { Bet, Poll } from "./Poll";

const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
})

let userInServerValidator: CheckUserInServer;
let checkUserIsOwnerValidator: CheckUserIsOwner;


checkUserIsOwnerValidator = function(potentialOwnerId: string) {
    let serverId = process.env.SERVERID
    if (serverId == null) {
        serverId = ''
    }
    let guild = client.guilds.cache.get(serverId)
    if (guild == undefined) {
        return false
    }
    let actualOwner = guild.ownerId
    return actualOwner == potentialOwnerId
}

userInServerValidator = function(userId: string): boolean {
    let serverId = process.env.SERVERID
    if (serverId == null) {
        serverId = ''
    }
    let guild = client.guilds.cache.get(serverId)
    if (guild == undefined) {
        return false
    }
    let member = guild.members.cache.get(userId)
    return member !== null && member !== undefined 
}

//Read the data into memory
const moneyRecordDatabase = MoneyRecordDatabase.readDataFile("data.txt", userInServerValidator, checkUserIsOwnerValidator)
let pollsRightNow = Poll.readPollsFromFile("polldata.txt")
Poll.latestId = pollsRightNow.map(x => x.pollId).reduce((x, y) => Math.max(x, y), 1) + 1
Poll.setToBeLockedAllInTime(pollsRightNow)

//Create a one-time backup
moneyRecordDatabase.writeDataFile("dataArchive\\data" + Date.now().toString() + "txt")

//Define a function that checks if user is on the server

setInterval(function() {
    moneyRecordDatabase.writeDataFile("data.txt")
    Poll.writePollsToFile("polldata.txt", pollsRightNow)
}, 60 * 1000); 


client.on('ready', () =>{
    console.log("Ready for action!")

})

client.on('messageCreate', message => {
    console.log(message.content);
    if (message.author.bot) {
        console.log(message?.member?.permissions.has(PermissionsBitField.Flags.ManageNicknames));
        return
    }
    const messageParts = message.content.split(" ").map(x => x.toLowerCase())
    if ((client.user == null ||( !message.mentions.has(client.user)) && (messageParts.length < 1 && messageParts[0] != process.env.BOTCOMMAND))) {
        return
    }
    //Mathing cases for bot actions

    //Adding money as Admin
    if (messageParts.length == 4 && messageParts[1] == "add" && !isNaN(parseFloat(messageParts[3]))) {
        const moneyWasAdded = moneyRecordDatabase.addCoins(message.author.id, getUserId(messageParts[2]), parseFloat(messageParts[3]))
        if (moneyWasAdded == 0) {
            message.reply(`No money was added, the balance is still ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))}`)
        }
        message.reply(`Added ${parseFloat(messageParts[3])} to <@${getUserId(messageParts[2])}>'s account. The new balance is ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))}`)
    }

    //Transfer from one person to another
    if (messageParts.length == 4 && messageParts[1] == "transfer" && !isNaN(parseFloat(messageParts[3]))) {
        const transferedmoney = moneyRecordDatabase.transferCoins(message.author.id, message.author.id, getUserId(messageParts[2]), parseFloat(messageParts[3]))
        message.reply(`Transferred ${transferedmoney} from <@${message.author.id}>'s account to <@${getUserId(messageParts[2])}>'s account. `+
        `The new balance is ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))} for <@${getUserId(messageParts[2])}> and ${moneyRecordDatabase.getCoinAmount(message.author.id)} for <@${message.author.id}>`)
    }

    //Set the balance as Admin
    if (messageParts.length == 4 && messageParts[1] == "set" && !isNaN(parseFloat(messageParts[3]))) {
        const newBalance = moneyRecordDatabase.setCoins(message.author.id, getUserId(messageParts[2]), parseFloat(messageParts[3]))
        message.reply(`Set <@${getUserId(messageParts[2])}>'s balance to ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))}`)
    }

    //Check user's balance
    if ((messageParts.length == 3 && messageParts[1] == "balance" &&
     userInServerValidator(getUserId(messageParts[2]))) || (messageParts.length == 2 && messageParts[1] == "balance")) {
        if (2 == messageParts.length ) {
            messageParts.push(message.author.id)
        }
        message.reply(`<@${getUserId(messageParts[2])}>'s balance is ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))} <:den_dobre:891762619193634876>`)
    }

    //Take reward
    if ((messageParts.length == 2 && messageParts[1] == "reward")) {
        const infoAboutReward = moneyRecordDatabase.takeFreeMoneyReward(message.author.id)
        const retIn = msToTimeUpToHour(infoAboutReward.nextRewardIn)
        if (infoAboutReward.isSucessfullyTaken) {
            message.reply(`You have collected your reward <:Artjom_pog:973178773694455841>! Your new balance is ${moneyRecordDatabase.getCoinAmount(message.author.id)}. Return in ${retIn}`)
        } else {
            message.reply(`Be a bit more paitent, you can collect your reward in ${retIn}`)
        }
        
    }

    //Coin leaderbord
    if ((messageParts.length == 2 && messageParts[1] == "top") || (messageParts.length == 3 && messageParts[1] == "top" &&  !isNaN(parseInt(messageParts[2]))) ) {
        if (messageParts.length == 2) {
            messageParts.push("5")
        }
        const numberOfLeadersToShow = parseInt(messageParts[2])
        const leaders = moneyRecordDatabase.getLeaderBordRangeFromHighest(numberOfLeadersToShow)
        
        let messageContent = `The current top ${leaders.length} are:`
        let counter = 1
        let previousValue = -1
        leaders.map(x => {
            if (x.currentBalance == previousValue) {
                counter --
            }
            previousValue = x.currentBalance
            messageContent += `\n${counter}. <@${x.userId}> at ${x.currentBalance}`
            counter ++
        })
        message.reply("A").then(x => x.edit(messageContent))
    }

    //Duel for coins
    if (messageParts.length == 3 && messageParts[1] == "accept" && !isNaN(parseFloat(messageParts[2])) && message.type == MessageType.Reply) {
        message.fetchReference().then(x => {
            if (x == null || x == undefined) {
                return 
            }
            const originalBattleInvetation = x.content
            const invitationParts = originalBattleInvetation.split(" ").map(x => x.toLowerCase())
            if (invitationParts.length != 4) {
                return 
            }
            const isAccepterSame = message.author.id == getUserId(invitationParts[2])
            const isAmountSame = !isNaN(parseFloat(invitationParts[3])) && parseFloat(invitationParts[3]) == parseFloat(messageParts[2])
            //The cache has to be cleared, because otherwise not all reactions show-up
            x.channel.messages.cache.delete(x.id);
            x.reactions.cache.clear()
            x.fetch().then(x => {
                if (client.user != null && invitationParts.length == 4 &&
                 invitationParts[1] == "duel" && isAccepterSame && isAmountSame && (x.reactions.resolve('👍')?.count == undefined || x.reactions.resolve('👍')?.count == 0)) {
                    
                    let gameAmount = Math.max(0, parseFloat(invitationParts[3]))
                    gameAmount = Math.min(gameAmount, Math.max(moneyRecordDatabase.getCoinAmount(message.author.id), 0), Math.max(moneyRecordDatabase.getCoinAmount(x.author.id), 0))
                    let result = new DuelManager().battle(message.author.id, x.author.id, gameAmount)
                    if (result.outcomeCode == 1) {
                        moneyRecordDatabase.addCoinsBypassOwnerCheck(message.author.id, gameAmount)
                        moneyRecordDatabase.addCoinsBypassOwnerCheck(x.author.id, -gameAmount)
                    } else if (result.outcomeCode == 2) {
                        moneyRecordDatabase.addCoinsBypassOwnerCheck(x.author.id, gameAmount)
                        moneyRecordDatabase.addCoinsBypassOwnerCheck(message.author.id, -gameAmount)
                    }
                    result.outcomeText += ` <@${x.author.id}>'s balance is now ${moneyRecordDatabase.getCoinAmount(x.author.id)} and <@${message.author.id}>'s balance is now ${moneyRecordDatabase.getCoinAmount(message.author.id)}`
                    message.reply(result.outcomeText)
                    x.react("👍")
                } 
            }
            )
            
        })
    }

    //Initiate the duel
    if (messageParts.length == 4 && messageParts[1] == "duel" && userInServerValidator(getUserId(messageParts[2])) && !isNaN(parseFloat(messageParts[3]))) {
        message.reply(`<@${getUserId(messageParts[2])}>, you have been challanged to a duel. Reply to the original message with : \`${process.env.BOTCOMMAND} accept ${messageParts[3]}\` to accept the duel`)
    }

    //Get list of possible commands
    if (messageParts.length == 2 && messageParts[1] == "help") {
        
        let infoMessage = `To use the bot, type one of the following commands:\n`
        infoMessage += `\`${process.env.BOTCOMMAND} reward\` - to collet your free money\n`
        infoMessage += `\`${process.env.BOTCOMMAND} help\` - to list the available commands\n`
        infoMessage += `\`${process.env.BOTCOMMAND} balance <user>\` - to check user's balance\n`
        infoMessage += `\`${process.env.BOTCOMMAND} top <x>\` - to see the top users by coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} transfer <user> <x>\` - to transfer x coins to the specified user\n`
        infoMessage += `\`${process.env.BOTCOMMAND} duel <user> <x>\` - to challange a user to a random duel by betting x coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} check shop\` - to view what can be bought in the shop\n`
        infoMessage += `\nPoll commands:\n`
        infoMessage += `\`${process.env.BOTCOMMAND} add poll <name> <option1> <option2> ...\` - to add a poll\n`
        infoMessage += `\`${process.env.BOTCOMMAND} bet poll<pollid> opt<optionNumber> <x> \` - to place a bet of x in the poll\n`
        infoMessage += `\`${process.env.BOTCOMMAND} view bets poll<pollid>\` - to view all bets for a poll\n`
        infoMessage += `\`${process.env.BOTCOMMAND} view polls\` - to view all polls\n`
        infoMessage += `\`${process.env.BOTCOMMAND} resolve poll<pollid> opt<optionNumber>\` - to resolve a poll (Admin only)\n`
        infoMessage += `\`${process.env.BOTCOMMAND} undo poll<pollid>\` - to undo a poll (Admin only)\n`
        infoMessage += `\`${process.env.BOTCOMMAND} lock poll<pollid>\` - to lock a poll (Admin only)\n`
        infoMessage += `\`${process.env.BOTCOMMAND} lock poll<pollid> <days> <hours> <minutes>\` - to lock a poll in some time (Admin only)\n`
        infoMessage += `\`${process.env.BOTCOMMAND} locksin poll<pollid>\` - to check when the poll will be locked\n`
        message.reply(infoMessage)
    }

    //Create a poll as admin
    if (messageParts[1] == "add" && messageParts[2] == "poll"&& messageParts.length >= 6) {
        let counter = 0;
        const substrings = message.content.replaceAll(/\`\`/g, '\` \`').split("\`").filter(x => {
            counter ++
            return ((counter-1) % 2) === 1
        })
        if (substrings.length >= 3) {
            const options = substrings.slice(1, undefined)
            const question = substrings[0]
            const addedPoll = new Poll(options, question)
            pollsRightNow.push(addedPoll)
            let toSend = `\`${question}\` -> Poll **${addedPoll.pollId}**`
            counter = 1
            options.forEach(x => {
                toSend += `\n${counter}. \`${x}\``
                counter ++
            })
            message.channel.send(toSend)
        }
    }

    //Place a bet
    if (messageParts.length == 5 && messageParts[1] == "bet" && checkCorrectPollFormat(messageParts[2])
     && checkCorrectOptionFormat(messageParts[3]) && checkStringIsPositiveNumber(messageParts[4])) {
        const betAmount = Math.min(Math.max(moneyRecordDatabase.getCoinAmount(message.author.id), 0), parseFloat(messageParts[4]))
        const pollId = parseInt(messageParts[2].slice(4, undefined))
        const pollOption = parseInt(messageParts[3].slice(3, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined || pollOption > pollFound.optionNames.length || pollFound.pollStatus != "OPEN") {
            return 
        }
        pollFound.makeABet(new Bet(pollOption, betAmount, message.author.id))
        moneyRecordDatabase.addCoinsBypassOwnerCheck(message.author.id, -betAmount)
        message.react("👍")
    }

    //View bets right now
    if (messageParts.length == 4 && messageParts[1] == "view" && messageParts[2] == "bets" && checkCorrectPollFormat(messageParts[3])) {
        const pollId = parseInt(messageParts[3].slice(4, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined) {
            return 
        }
        const optionNames = pollFound.optionNames
        const spacesToAdd = addSpacesToMakePrettierDisplayingBetPercentages(optionNames, 5)
        const votesPerOption = pollFound.getVotesPerOption()
        const totalAmount = pollFound.getTotalPollAmount()
        let toSend = `\`${pollFound.question}\` -> Poll **${pollFound.pollId}**`
        toSend = appendVotesPerPollOption(toSend, optionNames, votesPerOption, totalAmount)
        message.reply(toSend)
    }

    //View polls right now
    if (messageParts.length == 3 && messageParts[1] == "view" && messageParts[2] == "polls") {
        if (pollsRightNow.length == 0) {
            message.reply("No polls running right now")
        } else {
        let counter = 0
        let toSend = `The polls right now are:`
        counter = 1
        pollsRightNow.forEach(x => {
            let openMessage = ''
            if (x.pollStatus == "OPEN") {
                openMessage = "Open for bets"
            } else if (x.pollStatus == "LOCKED") {
                openMessage = "Closed for bets"
            } else if (x.pollStatus == "CLOSED") {
                openMessage = "Has already resolved"
            }
            toSend += `\n${counter}. \`${x.question}\` -> Poll **${x.pollId}** ${openMessage}`
            counter ++
        })
        message.reply(toSend) 
        }
    }

    //Resolve a poll
    if (messageParts.length == 4 && messageParts[1] == "resolve"  && checkCorrectPollFormat(messageParts[2])
     && checkCorrectOptionFormat(messageParts[3])&& checkUserIsOwnerValidator(message.author.id)) {
        const pollId = parseInt(messageParts[2].slice(4, undefined))
        const pollOption = parseInt(messageParts[3].slice(3, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined || pollOption > pollFound.optionNames.length || pollFound.pollStatus == "CLOSED") {
            return 
        }
        let results = pollFound.resolveBet(pollOption)
        results.forEach(x => moneyRecordDatabase.addCoinsBypassOwnerCheck(x[0], x[1]))
        pollFound.markAsClosed(pollOption)
        
        let toSend = `The poll \`${pollFound.question}\` has concluded with \`${pollFound.optionNames[pollOption-1]}\`. The winners are:`
        results = results.filter(x =>x[1] > 0).sort((x, y) => - x[1] +y[1])
        results.forEach(x => {
            toSend += `\n<@${x[0]}> - ${x[1]}`
        })
        message.channel.send(toSend) 
    }

    //Undo a poll
    if (messageParts.length == 3 && messageParts[1] == "undo" && checkCorrectPollFormat(messageParts[2]) && checkUserIsOwnerValidator(message.author.id)) {
        const pollId = parseInt(messageParts[2].slice(4, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined) {
            return 
        }
        pollsRightNow = pollsRightNow.filter(x => x.pollId != pollFound.pollId)
        const results = pollFound.giveBackWhenUndone()
        results.forEach(x => moneyRecordDatabase.addCoinsBypassOwnerCheck(x[0], x[1]))
        
        let toSend = `The poll \`${pollFound.question}\` has been undone. All spent money was returned`
        message.channel.send(toSend)
    }

    //Lock a poll in some time
    if (messageParts.length == 6 && messageParts[1] == "lock" && checkCorrectPollFormat(messageParts[2]) && checkUserIsOwnerValidator(message.author.id) &&
    isInteger(messageParts[3]) && isInteger(messageParts[4]) && isInteger(messageParts[5])) {
        const pollId = parseInt(messageParts[2].slice(4, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined) {
            return 
        }
        const days = parseInt(messageParts[3])
        const hours = parseInt(messageParts[4])
        const minutes = parseInt(messageParts[5])
        pollFound.lockInTime(days, hours, minutes)
        message.react("👍")
    }

    //Lock a poll 
    if (messageParts.length == 3 && messageParts[1] == "lock" && checkCorrectPollFormat(messageParts[2]) && checkUserIsOwnerValidator(message.author.id)) {
        const pollId = parseInt(messageParts[2].slice(4, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined) {
            return 
        }
        pollFound.markAsLocked()
        let toSend = `The poll \`${pollFound.question}\` has been locked. No more bets can be placed`
        const optionNames = pollFound.optionNames
        const votesPerOption = pollFound.getVotesPerOption()
        const totalAmount = pollFound.getTotalPollAmount()
        toSend = appendVotesPerPollOption(toSend, optionNames, votesPerOption, totalAmount)
        message.channel.send(toSend)
    }

    //Check when pool is locked
    if (messageParts.length == 3 && messageParts[1] == "locksin" && checkCorrectPollFormat(messageParts[2])) {
        const pollId = parseInt(messageParts[2].slice(4, undefined))
        const pollFound = pollsRightNow.find(x => x.pollId == pollId)
        if (pollFound == undefined) {
            return 
        }
        if (pollFound.pollStatus == "LOCKED" || pollFound.pollStatus == "CLOSED") {
            message.reply(`Poll \`${pollFound.question}\` is already locked`)
        } else if (pollFound.toBeLockedAt == undefined) {
            message.reply(`Poll \`${pollFound.question}\` does not have a concrete locking time`)
        } else {
            const timeToClose = pollFound.toBeLockedAt - Date.now();
            const timeAsString = msToTimeUpToDay(timeToClose)
            message.reply(`Poll \`${pollFound.question}\` closes in ${timeAsString}`)
        }
    }

    //View shop
    if (messageParts.length == 3 && messageParts[1] == "check" && messageParts[2] == "shop") {
        let infoMessage = `The shop has the following options:\n`
        infoMessage += `\`${process.env.BOTCOMMAND} buy give role <user>\` - assign a special role to the user (even  yourself) - ${process.env.GET_ROLE_PRICE} coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} buy remove role <user>\` - remove a special role to the user (even  yourself) - ${process.env.REMOVE_ROLE_PRICE} coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} buy increase reward\` - to increse the reward amount by ${process.env.INCREASE_REWARD_AMOUNT} (max ${process.env.MAX_PURCHASE_INCREASE_REWARD} times) - ${process.env.INCREASE_REWARD_PRICE} coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} buy reduce wait time\` - to reduce the wait time for next reward by ${parseIntElseZero(process.env.REDUCE_WAIT_TIME_DURATION) / 60000} minutes (max ${process.env.MAX_REDUCE_WAIT_TIME} times) - ${process.env.REDUCE_WAIT_TIME_PRICE} coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} buy admin sing karaoke\` - to make the administrator perform karaoke of a chosen song (max 210 seconds) - ${process.env.ORDER_KARAOKE_PRICE} coins\n`
        infoMessage += `\`${process.env.BOTCOMMAND} buy rename <user> <toRenameAs>\` - to rename the user however you want (administrator can ban for inappropriate names) - ${process.env.RENAME_USERNAME_PRICE} coins\n`
        message.reply(infoMessage)
    }

    //Buying stuff
    if (messageParts.length > 2 && messageParts[1] == "buy") {
        const buyer = message.author.id;
        let isEnoughMoneyOnBalance = false
        let maxReached = false
        //Giving a special role
        if (messageParts.length == 5 && messageParts[2] == "give" && messageParts[3] == "role" && userInServerValidator(getUserId(messageParts[4]))) {
            if (moneyRecordDatabase.doesUserHaveEnoughCoins(buyer, parseIntElseZero(process.env.GET_ROLE_PRICE))) {
                isEnoughMoneyOnBalance = true;
                let affectedUser;
                if (message.guild !== null) {
                    affectedUser = message.guild.members.cache.get(getUserId(messageParts[4]))
                    console.log(affectedUser)
                    const role= affectedUser?.guild.roles.cache.find(role => role.name === process.env.SPECIAL_REWARD_ROLE_NAME);
                    console.log(role)
                    if (role != undefined) {
                       affectedUser?.roles.add(role); 
                       moneyRecordDatabase.addCoinsBypassOwnerCheck(buyer, -parseIntElseZero(process.env.GET_ROLE_PRICE))
                    }
                }
            }
            //Removing a special role
        } else if (messageParts.length == 5 && messageParts[2] == "remove" && messageParts[3] == "role" && userInServerValidator(getUserId(messageParts[4]))) {
            if (moneyRecordDatabase.doesUserHaveEnoughCoins(buyer, parseIntElseZero(process.env.REMOVE_ROLE_PRICE))) {
                isEnoughMoneyOnBalance = true;
                let affectedUser;
                if (message.guild !== null) {
                    affectedUser = message.guild.members.cache.get((getUserId(messageParts[4])))
                    const role= affectedUser?.guild.roles.cache.find(role => role.name === process.env.SPECIAL_REWARD_ROLE_NAME);
                    if (role != undefined) {
                       affectedUser?.roles.remove(role); 
                       moneyRecordDatabase.addCoinsBypassOwnerCheck(buyer, -parseIntElseZero(process.env.REMOVE_ROLE_PRICE))
                    }
                }            }
            //Increasing reward
        } else if (messageParts.length == 4 && messageParts[2] == "increase" && messageParts[3] == "reward") {
            if (moneyRecordDatabase.doesUserHaveEnoughCoins(buyer, parseIntElseZero(process.env.INCREASE_REWARD_PRICE))) {
                isEnoughMoneyOnBalance = true;
                if (moneyRecordDatabase.purchaseRewardIncrease(buyer)) {
                    moneyRecordDatabase.addCoinsBypassOwnerCheck(buyer, -parseIntElseZero(process.env.INCREASE_REWARD_PRICE))
                } else {
                    maxReached = true
                }
            }

            //Reduce wait time
        } else if (messageParts.length == 5 && messageParts[2] == "reduce" && messageParts[3] == "wait" && messageParts[4] == "time") {
            if (moneyRecordDatabase.doesUserHaveEnoughCoins(buyer, parseIntElseZero(process.env.REDUCE_WAIT_TIME_PRICE))) {
                isEnoughMoneyOnBalance = true;
                if (moneyRecordDatabase.purchaseWaitTimeDecrease(buyer)) {
                    moneyRecordDatabase.addCoinsBypassOwnerCheck(buyer, -parseIntElseZero(process.env.REDUCE_WAIT_TIME_PRICE))
                } else {
                    maxReached = true
                }
            }
            //Karaoke
        } else if (messageParts.length == 5 && messageParts[2] == "admin" && messageParts[3] == "sing" && messageParts[4] == "karaoke") {
            if (moneyRecordDatabase.doesUserHaveEnoughCoins(buyer, parseIntElseZero(process.env.ORDER_KARAOKE_PRICE))) {
                isEnoughMoneyOnBalance = true;
                message.reply("You have successfully purchased karaoke, please message the admin!")
                moneyRecordDatabase.addCoinsBypassOwnerCheck(buyer, -parseIntElseZero(process.env.ORDER_KARAOKE_PRICE))
            }

            //Rename a user
        } else if (messageParts.length == 5 && messageParts[2] == "rename" && userInServerValidator(getUserId(messageParts[3]))) {
            if (moneyRecordDatabase.doesUserHaveEnoughCoins(buyer, parseIntElseZero(process.env.RENAME_USERNAME_PRICE))) {
                isEnoughMoneyOnBalance = true;
                let affectedUser;
                if (message.guild !== null) {
                    affectedUser = message.guild.members.cache.get(getUserId(messageParts[3]))
                    affectedUser?.setNickname(messageParts[4]);
                    moneyRecordDatabase.addCoinsBypassOwnerCheck(buyer, -parseIntElseZero(process.env.RENAME_USERNAME_PRICE))
                }  
            }
        }
        if (!isEnoughMoneyOnBalance) {
            message.reply("Sorry, you don't have enough coins to purchase that")
        } else if (maxReached) {
            message.reply("You have reached max number of upgrades")
        } else {
            message.react("👍")
        }


    }

})

function checkStringIsPositiveNumber(potentialNumber: string): boolean {
    if (isNaN(parseFloat(potentialNumber))) {
        return false
    } else {
        return parseFloat(potentialNumber) >= 0
    }
}

function checkCorrectOptionFormat(option: string): boolean {
    return (option.slice(0, 3) == "opt" && !isNaN(parseInt(option.slice(3, undefined))) && parseInt(option.slice(3, undefined)) > 0)
}

function checkCorrectPollFormat(poll: string): boolean {
    return (poll.slice(0, 4) == "poll" && !isNaN(parseInt(poll.slice(4, undefined))) && parseInt(poll.slice(4, undefined)) > 0)
}

function getUserId(fullMention: string): string {
    return fullMention.replaceAll(/\D/g,'');
}

function appendVotesPerPollOption(appendTo: string, optionNames: string[], votesPerOption: [number, number][], totalAmount: number): string {
    const spacesToAdd = addSpacesToMakePrettierDisplayingBetPercentages(optionNames, 5)
    let counter = 1
        optionNames.forEach(x => {
        appendTo += `\n\`${counter}. ${x}\`${" ".repeat(spacesToAdd[counter-1])}`+
        `${roundToTwoDecimals(votesPerOption[counter-1][1])}      ${roundToTwoDecimals(votesPerOption[counter-1][1]/ totalAmount * 100)}%`
        counter ++
    })
    return appendTo

}

function addSpacesToMakePrettierDisplayingBetPercentages(questions: string[], spacesAfterMax: number): number[] {
    const maxLengthOfStrings = questions.map(x => x.length).reduce((x, y) => Math.max(x, y), 0)
     return questions.map(x => (spacesAfterMax + Math.floor((maxLengthOfStrings - x.length)*11/5)))
}

function msToTimeUpToHour(duration: number): string {
    const seconds = Math.floor((duration / 1000) % 60)
    const minutes = Math.floor((duration / (1000 * 60)) % 60)
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    return `${hours} hours ${minutes} minutes ${seconds} seconds `;
}

function isInteger(toCheck: string): boolean {
    return !isNaN(parseInt(toCheck))
}

function parseIntElseZero(toParse: string | undefined): number {
    if (toParse === undefined) {
        return 0
    }
    if (isInteger(toParse)) {
        return parseInt(toParse)
    } else {
        return Math.round(parseFloat(toParse))
    }
}

function isFloat(toCheck: string): boolean {
   return !isNaN(parseFloat(toCheck))
}

function msToTimeUpToDay(duration: number): string {
    const seconds = Math.floor((duration / 1000) % 60)
    const minutes = Math.floor((duration / (1000 * 60)) % 60)
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    const days = Math.floor((duration / (1000 * 60 * 60 * 24)));
    return `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds `;
}

function roundToTwoDecimals(toRound: number): number {
    return Math.round(toRound * 100) / 100
}


client.login(process.env.TOKEN)