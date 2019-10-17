import UrlShorten from "../models/UrlShorten";
import nanoid from "nanoid";
import { DOMAIN_NAME } from "../config/constants";
import { respondWithWarning } from '../helpers/responseHandler';

/**
 * This function trims a new url that hasn't been trimmed before
 * @param {object} req
 * @param {object} res
 * @returns {object} response object with trimmed url
 */
export const trimUrl = async (req, res) => {
	try {
		let {expiry_date, custom_url} = req.body;

		let newUrlCode;

		//If the user submitted a custom url, use it. This has been validated by an earlier middleware.
		if (custom_url) newUrlCode = encodeURIComponent(custom_url); //Sanitize the string as a valid uri comp. first.
		else newUrlCode = nanoid(5); //If no custom url is provided, generate a random one.
    
		const newTrim = new UrlShorten({
			long_url: req.url,
			clipped_url: `${DOMAIN_NAME}/${newUrlCode}`,
			urlCode: newUrlCode,
			created_by: req.cookies.userID,
			click_count: 0
		});
		
		// If the user provided an expiry date, use it. If not, leave the field blank.
		if (expiry_date) {
			expiry_date = new Date(expiry_date);
			const currentDate = new Date();

			if (currentDate >= expiry_date) {
				return respondWithWarning(res, 400, "Expiration must occur on a future date");
			}

			newTrim.expiry_date = expiry_date;
		}		

		const trimmed = await newTrim.save()
		
    if (!trimmed) {
      console.log("Failed to save new trim");
			return respondWithWarning(res, 500, "Server error");
		}
		
		res.status(201).json({
			success: true,
			payload: trimmed
		});
  } 
  catch (err) {
		console.log(err);
    return respondWithWarning(res, 500, "Server error");
  }
};

/**
 * This function gets original url by the trim code supplied as a parameter
 * e.g trim.ly/TRIM_CODE
 * @param {object} req
 * @param {object} res
 * @returns {object} next middleware
 */
export const getUrlAndUpdateCount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const url = await UrlShorten.findOne({
      urlCode: id
    });

    if(url.expiry_date){
      const currentDate = new Date()
      if(currentDate > url.expiry_date){
        await UrlShorten.findByIdAndDelete(url._id)
        return res.status(404).render('error');
      }
    }

    if (!url) {
      return res.status(404).render('error');
    }

    url.click_count += 1;
    await url.save();
		
		if(url.long_url.startsWith('http'))
			return res.redirect(url.long_url);
		else 
			res.redirect(`http://${url.long_url}`);
  } catch (error) {
    return res.status(404).render('error');
  }
};
