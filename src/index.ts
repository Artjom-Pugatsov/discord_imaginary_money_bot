import { Client,  GatewayIntentBits} from "discord.js";
import {CheckUserInServer, CheckUserIsOwner} from "src/ServerValidator";
require("dotenv/config")
import {MoneyRecord} from "./Record"
import { MoneyRecordDatabase } from "./MoneyRecordDatabase";

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

//Create a one-time backup
moneyRecordDatabase.writeDataFile("dataArchive\\data" + Date.now().toString() + "txt")

//Define a function that checks if user is on the server

setInterval(function() {
    moneyRecordDatabase.writeDataFile("data.txt")
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
        message.reply(`Added ${moneyWasAdded} to <@${getUserId(messageParts[2])}>'s account. The new balance is ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))}`)
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
        message.reply(`<@${getUserId(messageParts[2])}>'s balance is ${moneyRecordDatabase.getCoinAmount(getUserId(messageParts[2]))}`)
    }

})

function getUserId(fullMention: string): string {
    return fullMention.replaceAll(/\D/g,'');
}

client.login(process.env.TOKEN)