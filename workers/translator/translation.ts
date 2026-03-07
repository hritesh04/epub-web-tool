import cheerio, { load } from "cheerio";
import { translate as tr } from "googletrans";
import fs from "fs";
import xml2js from "xml2js";

export async function translateHTML(path:string,html:string):Promise<string> {
    const $ = load(html);
    
    // Elements to translate
    const textElements = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'li', 'td', 'th', 'span', 'div', 'a', 
      'blockquote', 'cite', 'em', 'strong', 'b', 'i'
    ];
    
    // Collect all text to translate with their corresponding elements
    const textsToTranslate:string[] = [];
    const elementMap:{element:cheerio.Cheerio<any>,selector:string}[] = [];
    
    textElements.forEach(selector => {
      const elements = $(selector);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements.eq(i);
        
        // Only get direct text (not child elements)
        const directText = element
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .trim();
        
        if (directText.length > 0) {
          textsToTranslate.push(directText);
          elementMap.push({ element, selector });
        }
      }
    });
    
    console.log(`  Found ${textsToTranslate.length} text segments to translate on ${path}`);
    
    if (textsToTranslate.length === 0) {
      $("[lang]").attr("lang", "en");
      $("[xml\\:lang]").attr("xml:lang", "en");
      return $.html();
    }
    
    // Translate in batches using the library's batch API
    const batchSize = 40;
    const translatedTexts = [];
    
    for (let i = 0; i < textsToTranslate.length; i += batchSize) {
      const batch = textsToTranslate.slice(i, i + batchSize);

      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(textsToTranslate.length / batchSize);
      
      console.log(`    Translating batch ${batchNum}/${totalBatches} (${batch.length} items)...`);
      
      const batchResults = await translateBatch(batch);
      translatedTexts.push(...batchResults);
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < textsToTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(` Applying ${translatedTexts.length} translations...`);
    
    // Apply translations back to elements
    translatedTexts.forEach((translatedText, i) => {
      if (i < elementMap.length) {
        const { element } = elementMap[i];
        
        // Replace only the direct text nodes, preserving child elements
        element.contents().filter(function() {
          return this.type === 'text';
        }).replaceWith(translatedText);
      }
    });
    
    // Update lang attributes
    $("[lang]").attr("lang", "en");
    $("[xml\\:lang]").attr("xml:lang", "en");
    
    return $.html();
}

export async function translateNCX(content:string): Promise<string> {
  const parser = new xml2js.Parser();
  const builder = new xml2js.Builder();

  const result = await parser.parseStringPromise(content);

  const textsToTranslate: string[] = [];
  const textRefs: any[] = [];

  function collect(navPoints: any[]) {
    navPoints.forEach(nav => {
      const text = nav.navLabel?.[0]?.text?.[0];

      if (text) {
        textsToTranslate.push(text);
        textRefs.push(nav.navLabel[0].text);
      }

      if (nav.navPoint) {
        collect(nav.navPoint);
      }
    });
  }

  const navPoints = result.ncx.navMap[0].navPoint;
  collect(navPoints);

  console.log(`Found ${textsToTranslate.length} TOC entries`);

  if (textsToTranslate.length === 0) {
    return content;
  }

  // batching (same style as your HTML translator)
  const batchSize = 40;
  const translatedTexts: string[] = [];

  for (let i = 0; i < textsToTranslate.length; i += batchSize) {
    const batch = textsToTranslate.slice(i, i + batchSize);

    const batchResults = await translateBatch(batch);
    translatedTexts.push(...batchResults);

    if (i + batchSize < textsToTranslate.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`Applying ${translatedTexts.length} translations`);

  translatedTexts.forEach((t, i) => {
    textRefs[i][0] = t;
  });

  return builder.buildObject(result);
}


async function translateBatch(textArray:string[], retries = 5):Promise<string[]> {
    if (!textArray || textArray.length === 0) {
      return [];
    }
    
    async function attemptTranslate(texts:string[], attempt = 0):Promise<string[]> {
      if (texts.length === 0) {
        return [];
      }
      
      if (texts.length === 1) {
        try {
          const result = await tr(texts, {to: "en"});
          return result.textArray;
        } catch (err:any) {
          console.error(`Failed to translate single item:`, err.message);
          return texts;
        }
      }
      
      try {
        const result = await tr(texts, {to: "en"});
        return result.textArray;
      } catch (err:any) {
        console.error(`      Translation attempt ${attempt + 1} failed for batch of ${texts.length}:`, err.message);
        
        if (attempt < retries - 1) {
          const midpoint = Math.ceil(texts.length / 2);
          const firstHalf = texts.slice(0, midpoint);
          const secondHalf = texts.slice(midpoint);
          
          console.log(`    Subdividing batch: ${texts.length} → ${firstHalf.length} + ${secondHalf.length}`);
          
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          
          // Translate sequentially instead of parallel
          const firstResults = await attemptTranslate(firstHalf, attempt + 1);
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between halves
          const secondResults = await attemptTranslate(secondHalf, attempt + 1);
          
          return [...firstResults, ...secondResults];
        } else {
          console.warn(`  Failed to translate batch after ${retries} attempts, returning original texts`);
          return texts;
        }
      }
    }
    
    return attemptTranslate(textArray);
}
