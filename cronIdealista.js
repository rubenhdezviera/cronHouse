var CronJob = require('cron').CronJob;
var jsonfile = require('jsonfile');
var request = require('request-promise');
var cheerio = require('cheerio'); //HTML jQuery-like DOM parser
var nodemailer = require('nodemailer');
var fs = require('fs');

/* CONFIG FILES */
var EMAIL_CONFIG_FILE = './config_email.json';
var JOBS_CONFIG_FILE = './config_jobs.json'; // File holding an array of jobs
/* /CONFIG FILES */

/* GLOBAL VARS */
var IDEALISTA_BASE_URL = 'https://www.idealista.com';
var EMAIL_CONFIG = jsonfile.readFileSync(EMAIL_CONFIG_FILE);
var EMAIL_TEMPLATE_FILE = 'email_template.html';
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
    scrapIdealista(JOB);
  });

}, null, true, 'Atlantic/Canary');

function scrapIdealista(JOB) {
  request(JOB.request_options).then(function ($) {
    var items;
    try {
      items = jsonfile.readFileSync(JOB.output_json_file);
    } catch (error) {
      console.log('\n' + JOB.name + ': No existe fichero ' + JOB.output_json_file + ' -> Se creará uno nuevo');
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
      item['num_rooms'] = $(this).find('.item-detail').filter(function () {
        return $(this).html().search('<small>hab.</small>') > -1;
      }).text().substr(0, 1);
      item['num_rooms'] = item['num_rooms'] != '' ? parseInt(item['num_rooms']) : 0;
      item['m2'] = $(this).find('.item-detail').filter(function () {
        return $(this).html().search('<small>m&#xB2;</small>') > -1;
      }).text();
      item['m2'] = item['m2'] != '' ? parseInt(item['m2'].substr(0, item['m2'].indexOf(' '))) : 0;
      item['date_added'] = new Date().getTime();

      $(this).find('.item-toolbar-contact').each(function(index,e) {
        var phoneData = $(e).find('.item-clickable-phone');
        item['phone'] = $(phoneData).attr('href') == undefined ? '' : $(phoneData).attr('href').replace('tel:', '').trim();
        item['real_estate'] = $(phoneData).attr('data-xiti-page') == undefined ? true : $(phoneData).attr('data-xiti-page').indexOf('particular') == -1;
      });

      var pictures = [];
       $(this).find('img').each(function(i,e) {
        var possible_img = $(e).attr('data-ondemand-img');
        if(possible_img.indexOf('WEB_LISTING') > -1)
          pictures.push( possible_img );
      });
      item['pictures'] = pictures;

      if (!items[item['id_idealista']] && item['price'] > 0) {
        items[item['id_idealista']] = item;
        JOB.new_items.push(item);
        //console.log('Added: ' + JSON.stringify(item));
      }
    });

    jsonfile.writeFileSync(JOB.output_json_file, items);

    var next_url = $('.icon-arrow-right-after').attr('href');
    next_url = next_url != undefined ? IDEALISTA_BASE_URL + next_url : '';
    JOB.num_pages++;

    if (next_url != '' && JOB.num_pages < JOB.max_pages) {
      JOB.request_options.url = next_url;
      scrapIdealista(JOB);

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
            html: loadEmailTemplate(item)
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
}

function loadEmailTemplate(item) {
  var template = fs.readFileSync(EMAIL_TEMPLATE_FILE, "utf8");
  for (var property in item) {
    if (item.hasOwnProperty(property)) {
      if(property == "pictures") {
        var pictures_html = "";
        item.pictures.forEach(function(picture){
          var detail_img = picture.replace('WEB_LISTING', 'WEB_DETAIL-L-L');
          pictures_html += '<tr><td style="vertical-align: top;"><a target="_blank" href="'+detail_img+'"><img style="margin: 0; Margin-bottom: 15px;" src="'+picture+'"/></a></td></tr>';
        });
        template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), pictures_html);

      } else if(property == "real_estate") {
        if(item.real_estate)
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), '');
        else
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), '¡DE PARTICULAR!');

      } else if(property == "phone") {
        if(item.phone == '')
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), '');
        else {
          var phoneButton = '<br /><tr><td style="font-family: sans-serif; font-size: 14px; vertical-align: top; background-color: #3498db; border-radius: 5px; text-align: center;"><a href="tel:'+item.phone+'" target="_blank" style="display: inline-block; color: #ffffff; background-color: #3498db; border: solid 1px #3498db; border-radius: 5px; box-sizing: border-box; cursor: pointer; text-decoration: none; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-transform: capitalize; border-color: #3498db;">LLAMAR</a></td></tr>'
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), phoneButton);
        }

      } else 
        template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), item[property]);
    }
  }
  return template;
};