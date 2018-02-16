var CronJob = require('cron').CronJob;
var jsonfile = require('jsonfile');
var request = require('request-promise');
var cheerio = require('cheerio'); //HTML jQuery-like DOM parser
var nodemailer = require('nodemailer');
var fs = require('fs');

/* CONFIG FILES */
var EMAIL_CONFIG_FILE = './config_email.json';
var FILE_CONFIG_JOBS = './config_jobs.json'; // File holding array of jobs
/* /CONFIG FILES */

/* GLOBAL VARS */
var IDEALISTA_BASE_URL = 'https://www.idealista.com';
var EMAIL_CONFIG = jsonfile.readFileSync(EMAIL_CONFIG_FILE);
var CONFIG_JOBS = jsonfile.readFileSync(FILE_CONFIG_JOBS);
var CHROME_UA = { 'User-Agent': 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36' };

var transporter = nodemailer.createTransport({
  service: EMAIL_CONFIG.mail.service,
  auth: EMAIL_CONFIG.mail.auth
});

/* /GLOBAL VARS */

//Run each 4 minutes
new CronJob('0 */4 * * * *', function () {

  CONFIG_JOBS.forEach(function(JOB) {
    console.log('\n\n' + JOB.name + ' JOB started @ ' + new Date() + '\n\nScrapping...');
    JOB['first_run'] = false;
    JOB['num_pages'] = 0;
    JOB['new_items'] = [];

    var request_options = {
      url: JOB.init_url,
      transform: function (body) {
        return cheerio.load(body);
      },
      headers: CHROME_UA
    };

    request(request_options).then(function ($) {
      var items;
      try {
        items = jsonfile.readFileSync(JOB.output_json_file);
      } catch (error) {
        console.log('\n\nNo existe fichero ' + JOB.output_json_file + ' -> Se creará uno nuevo');
        items = {};
        JOB.first_run = true;
      }

      $('article').each(function (i) {
        var item = {};
        item['id_idealista'] = $(this).children('.item').attr('data-adid');
        item['title'] = $(this).find('.item-link').text();
        item['link'] = IDEALISTA_BASE_URL + $(this).find('.item-link').attr('href');
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
          JOB.new_items.push(item);
          //console.log('Added: ' + JSON.stringify(item));
        }
      });

      jsonfile.writeFileSync(JOB.output_json_file, items);

      var next_url = $('.icon-arrow-right-after').attr('href');
      next_url = next_url != undefined ? IDEALISTA_BASE_URL + next_url : '';

      if (next_url != '' && JOB.num_pages < JOB.max_pages) {
        scrapIdealista(next_url);

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
                  passes = eval(item[property] + filters[property]);
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
              html: loadEmailTemplate(item)
            }, function (err, info) {
              if (err) { console.log(err); }
            });
          }
        });
        console.log('\n\nDone scrapping ' + JOB.name + ' @ ' + new Date() + '\n\nTotal Items Added: ' + total_new_items + '\n\nTotal Items: ' + total_items);
      }
    });
  });

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

  
}