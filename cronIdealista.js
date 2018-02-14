var CronJob = require('cron').CronJob;
var jsonfile = require('jsonfile');
var request = require('request-promise');
var cheerio = require('cheerio'); //HTML jQuery-like DOM parser
var nodemailer = require('nodemailer');
var fs = require('fs');

/* CONFIG FILES */
var PROFILE_CONFIG_FILE = './config_profile.json';
var FILE_CONFIG_IDEALISTA = './config_idealista.json';
/* /CONFIG FILES */

/* GLOBAL VARS */
var PROFILE_CONFIG = jsonfile.readFileSync(PROFILE_CONFIG_FILE);
var CONFIG_IDEALISTA = jsonfile.readFileSync(FILE_CONFIG_IDEALISTA);
var OUTPUT_JSON_FILE = CONFIG_IDEALISTA.output_json_file;
var CHROME_UA = { 'User-Agent': 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36' };

var request_options = {
  url: '',
  transform: function (body) {
    return cheerio.load(body);
  },
  headers: CHROME_UA
};
var transporter = nodemailer.createTransport({
  service: PROFILE_CONFIG.mail.service,
  auth: PROFILE_CONFIG.mail.auth
});

var num_pages;
var new_items;
var max_pages;
/* /GLOBAL VARS */

//Run each 4 minutes
new CronJob('0 */4 * * * *', function () {
  console.log('\n\nIdealista JOB started @ ' + new Date() + '\n\nScrapping...');

  num_pages = 0;
  new_items = [];
  max_pages = CONFIG_IDEALISTA.max_pages;
  scrapIdealista(CONFIG_IDEALISTA.init_url);

}, null, true, 'Atlantic/Canary');

function loadEmailTemplate(item) {
  var template = fs.readFileSync('email_template.html', "utf8");
  for (var property in item) {
    if (item.hasOwnProperty(property)) {
      template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), item[property]);
    }
  }
  return template;
};

function scrapIdealista(init_url) {

  request_options.url = init_url;
  request(request_options).then(function ($) {
    var items;
    try {
      items = jsonfile.readFileSync(OUTPUT_JSON_FILE);
    } catch (error) {
      console.log('\n\nNo existe fichero ' + OUTPUT_JSON_FILE + ' -> Se creará uno nuevo');
      items = {};
    }

    $('article').each(function (i) {
      /*if(i==0){
        console.log('--HTML ITEM CODE-- ' + $(this).find('.item-detail').eq(1).html() + '--');
      }*/
      var item = {};
      item['id_idealista'] = $(this).children('.item').attr('data-adid');
      item['title'] = $(this).find('.item-link').text();
      item['link'] = 'https://www.idealista.com' + $(this).find('.item-link').attr('href');
      item['price'] = $(this).find('.item-price').text();
      item['price'] = item['price'].substr(0, item['price'].search('€/mes')).replace('.', '');
      item['price'] = item['price'] != '' ? parseInt(item['price']) : 0;
      item['description'] = $(this).find('.item-description').text();
      item['num_habs'] = $(this).find('.item-detail').filter(function () {
        return $(this).html().search('<small>hab.</small>') > -1;
      }).text().substr(0, 1);
      item['num_habs'] = item['num_habs'] != '' ? parseInt(item['num_habs']) : 0;
      item['m2'] = $(this).find('.item-detail').filter(function () {
        return $(this).html().search('<small>m&#xB2;</small>') > -1;
      }).text();
      item['m2'] = item['m2'] != '' ? parseInt(item['m2'].substr(0, item['m2'].indexOf(' '))) : 0;
      item['date_added'] = new Date().getTime();

      if (!items[item['id_idealista']] && item['price'] > 0 /* && item['price'] < 500 */) {
        items[item['id_idealista']] = item;
        new_items.push(item);
        //console.log('Added: ' + JSON.stringify(item));
      }
    });

    jsonfile.writeFileSync(OUTPUT_JSON_FILE, items);

    var next_url = $('.icon-arrow-right-after').attr('href');
    next_url = next_url != undefined ? 'https://www.idealista.com' + next_url : '';

    if (next_url != '' && num_pages < max_pages) {
      scrapIdealista(next_url);

    } else {
      var total_items = Object.keys(items).length;
      var total_new_items = new_items.length;

      new_items.forEach(function (item) {
        var destinataries = [];
        PROFILE_CONFIG.mail.destinataries["Idealista"].forEach(function (user) {
          var filters = user.filters;
          var passes = true;
          for (var property in filters) {
            if (filters.hasOwnProperty(property)) {
              if (passes) {
                passes = eval(item[property] + filters[property]);
              }
            }
          }
          if (passes) {
            destinataries.push(user.email);
          }
        });

        if (destinataries.length > 0) {
          transporter.sendMail({
            from: PROFILE_CONFIG.mail.auth.user,
            to: destinataries.toString(),
            subject: 'watchCat: ' + item.price + '€/mes | ' + item.title,
            html: loadEmailTemplate(item)
          }, function (err, info) {
            if (err) { console.log(err); }
          });
        }
      });
      console.log('\n\nDone scrapping Idealista @ ' + new Date() + '\n\nTotal Items Added: ' + total_new_items + '\n\nTotal Items: ' + total_items);
    }
  });
}