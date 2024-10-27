const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const qrcodeTerminal = require('qrcode-terminal');


const userDataDir = path.join(__dirname, 'volume/user_data');
const errorLogFile = path.join(__dirname, 'volume/error.log');
const infoLogFile = path.join(__dirname, 'volume/info.log');

// const lastMessageClassNames = ".x9f619.x1hx0egp.x1yrsyyn.x1ct7el4.x1dm7udd.xwib8y2, .x9f619.x1hx0egp.x1yrsyyn.x1sxyh0.xwib8y2.xohu8s8"
const lastMessageClassNames = ".x1iyjqo2.x6ikm8r.x10wlt62.x1n2onr6.xlyipyv.xuxw1ft.x1rg5ohu._ao3e, .x9f619.x1hx0egp.x1yrsyyn.x1sxyh0.xwib8y2.xohu8s8"
const contactPrefix = "#"

function logError(error) {
  if (!fs.existsSync(errorLogFile)) fs.writeFileSync(errorLogFile, '', { flag: 'wx' });
  fs.appendFileSync(errorLogFile, `${new Date().toISOString()} - ${error}\n`);
}

function logInfo(info) {
  if (!fs.existsSync(infoLogFile)) fs.writeFileSync(infoLogFile, '', { flag: 'wx' });
  fs.appendFileSync(infoLogFile, `${new Date().toISOString()} - ${info}\n`);
}

function log(info) {
  if (!fs.existsSync(infoLogFile)) fs.writeFileSync(infoLogFile, '', { flag: 'wx' });
  fs.appendFileSync(infoLogFile, `${info}\n`);
}

const getContactsList = async (page) => {
  const contactsList = await page.evaluate(async () => {
    const contacts = [];
    const scrollElement = document.querySelector(".x1n2onr6._ak9y");
    if (scrollElement) {
      const distance = 100;
      const delay = 100;
      while (scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight) {
        const contactElements = document.body.querySelectorAll("._ak73");
        contactElements.forEach(e => {
          const contactName = e.querySelectorAll("._ak8o")[0].querySelectorAll("._ak8q")[0].querySelectorAll(".x1iyjqo2")[0].innerHTML;
          contacts.push(contactName);
        });
        scrollElement.scrollBy(0, distance);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return [...new Set(contacts)];
  });
  return contactsList;
};

const doesContactExists = async (page, contactName) => {
  const doesExists = await page.evaluate(async (contactName) => {
    const scrollElement = document.querySelector(".x1n2onr6._ak9y");
    if (scrollElement) {
      const distance = 100; // Distance for each scroll
      const delay = 100; // Delay between each scroll
      const checkContactExists = () => {
        return document.querySelector(`span[title="${contactName}"]`) !== null;
      };
      while (scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight) {
        if (checkContactExists()) return true;
        scrollElement.scrollBy(0, distance);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      // Check one last time at the end of scrolling
      const exists = checkContactExists();
      if (!exists) scrollElement.scrollTo(0, 0);
      return exists
    }

    return false;
  }, contactName);
  return doesExists;
};

const sendMessage = async (page, contactName, message) => {
  const contactExists = await doesContactExists(page, contactName);

  if (contactExists) {
    console.log("contact exists");
    await page.click(`span[title="${contactName}"]`);
    await page.waitForSelector(lastMessageClassNames);

    const lines = message.split('\n'); // Split the message into lines

    for (let i = 0; i < lines.length; i++) {
        await page.keyboard.type(lines[i]); // Type the line

        // If it's not the last line, press Shift + Enter
        if (i < lines.length - 1) {
            await page.keyboard.down('Shift');
            await page.keyboard.press('Enter');
            await page.keyboard.up('Shift'); // Release Shift key
        }
    }

    await page.keyboard.press('Enter');
    logInfo(`Message sent to ${contactName}`);
  } else {
    logInfo(`Contact "${contactName}" not found.`);
  }
  await page.keyboard.press('Escape');
};

const onMutation = async (page) => {
  const newMessage = await page.evaluate(() => {
    const chatList = document.querySelector('#pane-side');
    if (!chatList) return false
    const incomingMsgExists = () => {
      return chatList?.querySelector(`._ak73`)[0]?.querySelector(`.x1rg5ohu.x173ssrc.x1xaadd7.x682dto.x1e01kqd.x12j7j87.x9bpaai.x1pg5gke.x1s688f.xo5v014.x1u28eo4.x2b8uid.x16dsc37.x18ba5f9.x1sbl2l.xy9co9w.x5r174s.x7h3shv`)[0] !== null;
    };



    return incomingMsgExists()
  });


  if (newMessage) {
    try {
      await page.click(`div[class="_ak72 _ak73 _ak7n"]`);
      await page.waitForSelector(lastMessageClassNames);

      const message = await page.evaluate(() => {
        const msgContainer = document.querySelectorAll('._amk4._amkd');
        const spanContainer = msgContainer[msgContainer.length - 1]?.querySelector('._ao3e.selectable-text.copyable-text');

        // Retrieve all span elements
        const spans = spanContainer?.querySelectorAll('span');

        // Concatenate their innerText with a newline separator
        const spanText = Array.from(spans).map(span => span.innerText).join('\n');

        return spanText;
      });

      const splitIndex = message.indexOf('\n');
      if (splitIndex > 0 && message.startsWith(contactPrefix)) {
        const groupNames = message.substring(0, splitIndex).split(contactPrefix).filter(Boolean); // Filter out empty strings
        const groupMessage = message.substring(splitIndex + 1);


        for (const groupName of groupNames) {
          const trimmedGroupName = groupName.trim();
          if (trimmedGroupName) {
            await sendMessage(page, trimmedGroupName, groupMessage);
          }
        }
      }
      else {
        page.keyboard.press('Escape');
      }



    }
    catch (err) {
      console.log(1);
      console.log(err);
      logError(err)
    }
  }


}

const displayQr = async (page) => {
  const qrText = await page.evaluate(() => {
    const qrElement = document.querySelector('._akau');
    return qrElement?.getAttribute('data-ref')
  });

  console.log('QR Code:', qrText);
  logInfo('QR Code:', qrText);
  if (qrText)
    qrcodeTerminal.generate(qrText, { small: true }, (qrCode) => {
      console.log(qrCode);
      log(qrCode);
    });
}

(async () => {

  // const date = new Date()
  // const expiryDate = new Date("2024-06-21")

  // if (date > expiryDate) return



  try {

    logInfo("node started")

    const browser = await puppeteer.launch({
      // headless: "new",
      // // headless: false,
      // // executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      // executablePath: `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`, // Path to Chrome in Docker
      // args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // userDataDir

      headless: true, // Enable headless mode
      executablePath: '/usr/bin/chromium-browser', // Path to Chromium on Linux VPS
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir
    });

    logInfo("browser started")

    const pages = await browser.pages();
    const page = pages[0];

    await page.goto('https://web.whatsapp.com');

    logInfo("whatsapp started")

    try {
      await page.waitForSelector('._akau', { timeout: 1 * 60 * 1000 });
    }
    catch (err) {
      logError("error while qr. maybe already logged in", err)
    }



    const qrInterval = setInterval(async () => { await displayQr(page) }, 10000)

    await page.waitForSelector('._ak73', { timeout: 5 * 60 * 1000 });

    clearInterval(qrInterval);



    logInfo("bot started")

    setInterval(async () => {
      await onMutation(page)
    }, 5000)



  } catch (error) {
    logError(error);
  }
})();
