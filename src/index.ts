import { Client,  GatewayIntentBits, MessageType} from "discord.js";
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
        return
    }
    const messageParts = message.content.split(" ").map(x => x.toLowerCase())
    if (!(client.user?.id != null && message.mentions.has(client.user.id))) {
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
    if ((messageParts.length == 3 && messageParts[1] == "balance" && userInServerValidator(getUserId(messageParts[2]))) || (messageParts.length == 2 && messageParts[1] == "balance")) {
        if (2 == messageParts.length ) {
            messageParts.push(message.author.id)
        }
        message.reply(`<@${getUserId(messageParts[2])}>'s balance is ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))} <:den_dobre:891762619193634876>`)
    }

    //Take reward
    if ((messageParts.length == 2 && messageParts[1] == "reward")) {
        const infoAboutReward = moneyRecordDatabase.takeFreeMoneyReward(message.author.id)
        const retIn = msToTime(infoAboutReward.nextRewardIn)
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
            const isAccepterSame = message.author.id == getUserId(invitationParts[2])
            const isAmountSame = !isNaN(parseFloat(invitationParts[3])) && parseFloat(invitationParts[3]) == parseFloat(messageParts[2])
            //The cache has to be cleared, because otherwise not all reactions show-up
            x.channel.messages.cache.delete(x.id);
            x.reactions.cache.clear()
            x.fetch().then(x => {
                if (client.user != null && invitationParts.length == 4 && x.mentions.has(client.user.id) && invitationParts[1] == "duel" && isAccepterSame && isAmountSame && (x.reactions.resolve('👍')?.count == undefined || x.reactions.resolve('👍')?.count == 0)) {
                
                    let gameAmount = Math.max(0, parseFloat(invitationParts[3]))
                    gameAmount = Math.min(gameAmount, moneyRecordDatabase.getCoinAmount(message.author.id), moneyRecordDatabase.getCoinAmount(x.author.id))
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
        message.reply(`<@${getUserId(messageParts[2])}>, you have been challanged to a duel. Reply to the original message with : \"<@${client.user.id}> accept ${messageParts[3]}\" to accept the duel`)
    }

    //Get list of possible commands
    if (messageParts.length == 2 && messageParts[1] == "help") {
        
        let infoMessage = `To use a command, please mention <@${client.user.id}> and then type one of the following commands:\n`
        infoMessage += `\`reward\` - to collet your free money\n`
        infoMessage += `\`help\` - to list the available commands\n`
        infoMessage += `\`balance <user>\` - to check user's balance\n`
        infoMessage += `\`top <x>\` - to see the top users by coins\n`
        infoMessage += `\`transfer <user> <x>\` - to transfer x coins to the specified user\n`
        infoMessage += `\`duel <user> <x>\` - to challange a user to a random duel by betting x coins\n`
        infoMessage += `\nPoll commands:\n`
        infoMessage += `\`add poll <name> <option1> <option2> ...\` - to add a poll\n`
        infoMessage += `\`bet poll<pollid> opt<optionNumber> <x> \` - to place a bet of x in the poll\n`
        infoMessage += `\`view bets poll<pollid>\` - to view all bets for a poll\n`
        infoMessage += `\`view polls\` - to view all polls\n`
        infoMessage += `\`resolve poll<pollid> opt<optionNumber>\` - to resolve a poll (Admin only)\n`
        infoMessage += `\`undo poll<pollid>\` - to undo a poll (Admin only)\n`
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
    if (messageParts.length == 5 && messageParts[1] == "bet" && checkCorrectPollFormat(messageParts[2]) && checkCorrectOptionFormat(messageParts[3]) && checkStringIsPositiveNumber(messageParts[4])) {
        const betAmount = Math.min(moneyRecordDatabase.getCoinAmount(message.author.id), parseFloat(messageParts[4]))
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
        let counter = 0
        let toSend = `\`${pollFound.question}\` -> Poll **${pollFound.pollId}**`
        counter = 1
        optionNames.forEach(x => {
            toSend += `\n\`${counter}. ${x}\`${" ".repeat(spacesToAdd[counter-1])}${votesPerOption[counter-1][1]}      ${votesPerOption[counter-1][1]/ totalAmount * 100}%`
            counter ++
        })
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
                openMessage = "HasAlreadyResolved"
            }
            toSend += `\n${counter}. \`${x.question}\` -> Poll **${x.pollId}** ${openMessage}`
            counter ++
        })
        message.reply(toSend) 
        }
    }

    //Resolve a poll
    if (messageParts.length == 4 && messageParts[1] == "resolve"  && checkCorrectPollFormat(messageParts[2]) && checkCorrectOptionFormat(messageParts[3])&& checkUserIsOwnerValidator(message.author.id)) {
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
        const spacesToAdd = addSpacesToMakePrettierDisplayingBetPercentages(optionNames, 5)
        const votesPerOption = pollFound.getVotesPerOption()
        const totalAmount = pollFound.getTotalPollAmount()
        let counter = 0
        counter = 1
        optionNames.forEach(x => {
            toSend += `\n\`${counter}. ${x}\`${" ".repeat(spacesToAdd[counter-1])}${votesPerOption[counter-1][1]}      ${votesPerOption[counter-1][1]/ totalAmount * 100}%`
            counter ++
        })
        message.channel.send(toSend)
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

function addSpacesToMakePrettierDisplayingBetPercentages(questions: string[], spacesAfterMax: number): number[] {
    const maxLengthOfStrings = questions.map(x => x.length).reduce((x, y) => Math.max(x, y), 0)
     return questions.map(x => (spacesAfterMax + Math.floor((maxLengthOfStrings - x.length)*11/5)))
}

function msToTime(duration: number): string {
    const milliseconds = Math.floor((duration % 1000) / 100)
    const seconds = Math.floor((duration / 1000) % 60)
    const minutes = Math.floor((duration / (1000 * 60)) % 60)
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    return `${hours} hours ${minutes} minutes ${seconds} seconds `;
}


client.login(process.env.TOKEN)