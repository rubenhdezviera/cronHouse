var CronJob = require('cron').CronJob;
var jsonfile = require('jsonfile');
var request = require('request-promise');
var cheerio = require('cheerio'); //HTML jQuery-like DOM parser

var FILE_CONFIG_IDEALISTA = './config_idealista.json';
var FILE_ITEMS_IDEALISTA_LAS_PALMAS = './items_idealista_laspalmas.json';
var CHROME_UA = {'User-Agent': 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36'};
var request_options = {
  url: '',
  transform: function (body) {
    return cheerio.load(body);
  },
  headers: CHROME_UA
};

var num_pages;
var MAX_PAGES;

new CronJob('*/20 */1 * * * *', function () {
  console.log('Idealista JOB started @ ' + new Date());

  config_idealista = jsonfile.readFileSync(FILE_CONFIG_IDEALISTA);
  num_pages = 0;
  MAX_PAGES = config_idealista.max_pages;
  scrapIdealista(config_idealista.init_url);

}, null, true, 'Atlantic/Canary');

function scrapIdealista(init_url) {

  request_options.url = init_url;

  request(request_options).then(function ($) {
    var items;
    try {
      items = jsonfile.readFileSync(FILE_ITEMS_IDEALISTA_LAS_PALMAS);
    }
    catch(error) {
      console.log('No existe fichero ' + FILE_ITEMS_IDEALISTA_LAS_PALMAS +' -> Se creará uno nuevo' ) ;
      items = {};
    }
         
    $('article').each(function (i) {
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
      item['date_added'] = new Date().getTime();
      
      if( !items[item['id_idealista']]  && item['price'] > 0 /* && item['price'] < 500 */) {

        items[item['id_idealista']] = item;
        //console.log('Added: ' + JSON.stringify(item));
      } /*else {
        console.log('repeated...');
      }*/
      
    });

    var file = FILE_ITEMS_IDEALISTA_LAS_PALMAS
    jsonfile.writeFileSync(file, items);
    
    console.log('Página ' + ++num_pages + ' scrapped!');

    var next_url = $('.icon-arrow-right-after').attr('href');
    next_url = next_url != undefined ? 'https://www.idealista.com' + next_url : '';
    
    if(next_url != '' && num_pages <= MAX_PAGES) {
      console.log('NEXT URL: ' + next_url);
      scrapIdealista(next_url);
    } else {
      console.log('Done scrapping Idealista!');
    }
  });
}