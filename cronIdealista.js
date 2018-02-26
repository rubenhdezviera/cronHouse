var CronJob = require('cron').CronJob;
var jsonfile = require('jsonfile');
var request = require('request-promise');
var cheerio = require('cheerio'); //HTML jQuery-like DOM parser
var nodemailer = require('nodemailer');
var fs = require('fs');

//custom modules
var inmoScrapper = require('./modules/inmo-scrapper.js');
var emailTemplate = require('./modules/email-template.js');

/* CONFIG FILES */
var EMAIL_CONFIG_FILE = './config_email.json';
var JOBS_CONFIG_FILE = './config_jobs.json'; // File holding an array of jobs
/* /CONFIG FILES */

/* GLOBAL VARS */
var IDEALISTA_BASE_URL = 'https://www.idealista.com';
var EMAIL_CONFIG = jsonfile.readFileSync(EMAIL_CONFIG_FILE);
var JOBS_CONFIG = jsonfile.readFileSync(JOBS_CONFIG_FILE);
var CHROME_UA = { 'User-Agent': 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36' };

var transporter = nodemailer.createTransport({
  service: EMAIL_CONFIG.mail.service,
  auth: EMAIL_CONFIG.mail.auth
});
/* /GLOBAL VARS */

//Run each 4 minutes
new CronJob('0 */4 * * * *', function () {

  JOBS_CONFIG.forEach(function(JOB) {
    console.log('\n\n' + JOB.name + ': Started scrapping @ ' + new Date());
    JOB['first_run'] = false;
    JOB['num_pages'] = 0;
    JOB['new_items'] = [];
    JOB['request_options'] = {
      url: JOB.init_url,
      transform: function (body) {
        return cheerio.load(body);
      },
      headers: CHROME_UA
    };
    scrapIt(JOB);
  });

}, null, true, 'Atlantic/Canary');

function scrapIt(JOB) {
  request(JOB.request_options).then(function ($) {
    var items;
    try {
      items = jsonfile.readFileSync(JOB.output_json_file);
    } catch (error) {
      console.log('\n' + JOB.name + ': No existe fichero ' + JOB.output_json_file + ' -> Se creará uno nuevo');
      items = {};
      JOB.first_run = true;
    }

    var scrapResult = {
      new_items:[],
      next_url: ''
    };
    switch (JOB.source) {
      case 'Fotocasa':
        var json_props = $.html().match(/<script>window\.__INITIAL_PROPS__=(\{.*?\})<\/script><script>window\.i18n/);
        var props = JSON.parse(json_props[1]);
        //jsonfile.writeFileSync('./dev/test_'+JOB.name+'.json', props.initialSearch.result.realEstates);
        scrapResult = inmoScrapper.scrapFotocasa($, props.initialSearch.result.realEstates);
        break;
      case 'Idealista':
        scrapResult = inmoScrapper.scrapIdealista($);
        break;
    } 
    scrapResult.new_items.forEach(function(item){
      if (!items[item['id']]) {
        items[item['id']] = item;
        JOB.new_items.push(item);
      }
    });

    jsonfile.writeFileSync(JOB.output_json_file, items);
    JOB.num_pages++;

    if (scrapResult.next_url != '' && JOB.num_pages < JOB.max_pages) {
      JOB.request_options.url = scrapResult.next_url;
      scrapIt(JOB);

    } else {
      var total_items = Object.keys(items).length;
      var total_new_items = JOB.new_items.length;

      JOB.new_items.forEach(function (item) {
        var destinataries = [];
        JOB.destinataries.forEach(function (user) {
          var filters = user.filters;
          var passes = true;
          for (var property in filters) {
            if (filters.hasOwnProperty(property)) {
              if (passes) {
                if(property == 'real_estate') {
                  passes = item.real_estate === filters.real_estate;
                } else {
                  passes = eval(item[property] + filters[property]);
                }
              }
            }
          }          
          if (passes) {
            destinataries.push(user.email);
          }
        });

        if (destinataries.length > 0 && !JOB.first_run) {
          transporter.sendMail({
            from: EMAIL_CONFIG.mail.auth.user,
            to: destinataries.toString(),
            subject: JOB.name + ' - ' + item.price + ' €/mes | ' + item.title,
            html: emailTemplate.loadEmailTemplate(item)
          }, function (err, info) {
            if (err) { 
              console.log(err); 
            } else {
              console.log('\n' + JOB.name + ': Mail sent to ' + destinataries.toString()); 
            }
          });
        }
      });
      console.log('\n' + JOB.name + ': Done scrapping @ ' + new Date() + '\nScrapped pages: ' + JOB.num_pages + '\nTotal Items Added: ' + total_new_items + '\nTotal Items: ' + total_items);
    } 
  });  
};