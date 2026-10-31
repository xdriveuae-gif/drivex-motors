/* English <-> Arabic switcher.
   ---------------------------------------------------------------
   How it works: pages stay English in the HTML. When the visitor picks
   Arabic, this script swaps every visible string using the dictionary
   below (exact-text match, plus a few patterns for counts/units), flips
   the page to RTL, and keeps translating anything the site adds later
   (cards, toasts, forms). Anything NOT in the dictionary — car titles,
   makes, prices, phone numbers, server error text — is left as is.

   TO EDIT A TRANSLATION: change the Arabic value on the right.
   TO ADD ONE: add  "English text exactly as shown": "العربية",
   Arabic text was machine-drafted: have a native speaker review it.
*/
(function () {
  'use strict';

  var AR = {
    /* ---- Navigation / chrome ---- */
    "Skip to content": "انتقل إلى المحتوى",
    "Home": "الرئيسية", "Buy a Car": "اشترِ سيارة", "Finance": "التمويل", "About": "من نحن",
    "Contact": "اتصل بنا", "Sell / Trade-in": "بيع / استبدال",
    "Primary navigation": "التنقل الرئيسي", "Toggle menu": "فتح القائمة",
    "DriveX Motors — home": "DriveX Motors — الرئيسية",
    "Switch to dark mode": "التبديل إلى الوضع الداكن", "Switch to light mode": "التبديل إلى الوضع الفاتح",
    "Language": "اللغة",

    /* ---- Home: hero + search ---- */
    "Drive Home Your Dream Car — Premium Pre-Owned Vehicles · Abu Dhabi": "قُد سيارة أحلامك إلى بيتك — سيارات مستعملة فاخرة · أبوظبي",
    "Search cars": "البحث عن سيارات",
    "Brand": "الماركة", "All brands": "كل الماركات", "Model": "الموديل", "All models": "كل الموديلات",
    "Max price": "أقصى سعر", "Any price": "أي سعر", "Show All Cars": "عرض كل السيارات",
    "Why buy from us": "لماذا تشتري منا",
    "Quality-checked cars": "سيارات مفحوصة الجودة", "Inspected before they are listed": "تُفحص قبل عرضها",
    "Warranty": "ضمان", "Peace of mind on our cars": "راحة البال مع سياراتنا",
    "Finance available": "التمويل متاح", "Flexible options to suit you": "خيارات مرنة تناسبك",
    "Trade-in accepted": "نقبل الاستبدال", "Sell or swap your current car": "بع سيارتك الحالية أو استبدلها",
    "Buy with confidence": "اشترِ بثقة", "Cars we are happy to stand behind": "سيارات نفخر بالوقوف خلفها",
    "Quality": "الجودة", "Hand-picked and inspected before they reach our showroom.": "تُختار بعناية وتُفحص قبل وصولها إلى معرضنا.",
    "Our cars come with a warranty. Ask our team for the full details.": "سياراتنا تأتي مع ضمان. اسأل فريقنا للحصول على التفاصيل الكاملة.",
    "Financing": "التمويل", "Finance options are available on our cars. Contact us to check your eligibility.": "خيارات التمويل متاحة على سياراتنا. تواصل معنا للتحقق من أهليتك.",
    "Just arrived": "وصل حديثاً", "New Stock": "أحدث السيارات", "See All →": "عرض الكل ←",
    "Sell or trade in": "بيع أو استبدال", "Your car, your way": "سيارتك، بطريقتك",
    "Tell us about your car and our team will get back to you with an offer.": "أخبرنا عن سيارتك وسيعود إليك فريقنا بعرض.",
    "Fill in the details": "أدخل التفاصيل", "Tell us about your car and how to reach you.": "أخبرنا عن سيارتك وكيف نتواصل معك.",
    "Free inspection and offer": "فحص وعرض مجاني", "We look at your car and make you an offer.": "نفحص سيارتك ونقدم لك عرضاً.",
    "Get paid or trade it in": "احصل على المبلغ أو استبدلها", "Take the payment, or put it towards your next car.": "استلم المبلغ، أو اجعله دفعة لسيارتك القادمة.",
    "Sell my car": "بيع سيارتي",
    "Finance made easy": "تمويل بكل سهولة", "Looking for finance? Check your eligibility and we will take it from there.": "تبحث عن تمويل؟ تحقق من أهليتك وسنتولى الباقي.",
    "Check Eligibility": "تحقق من الأهلية",
    "Why choose us": "لماذا تختارنا", "Buying a car, made simple": "شراء السيارة، ببساطة",
    "Quality you can check": "جودة يمكنك التحقق منها",
    "Every car is inspected before it is listed. Ask our team for the details on any car.": "كل سيارة تُفحص قبل عرضها. اسأل فريقنا عن تفاصيل أي سيارة.",
    "Customer care": "رعاية العملاء", "Our team is here to help before and after you buy.": "فريقنا هنا لمساعدتك قبل الشراء وبعده.",
    "Visit us": "زُرنا", "Visit Our Showroom": "زر معرضنا", "Phone": "الهاتف", "Landline": "الهاتف الأرضي",
    "Email": "البريد الإلكتروني", "Address": "العنوان", "Hours": "ساعات العمل", "Get directions": "احصل على الاتجاهات",
    "WhatsApp Us": "راسلنا عبر واتساب",
    "Industrial City - ICAD V - Abu Dhabi, Abu Dhabi, United Arab Emirates": "المدينة الصناعية - ICAD V - أبوظبي، أبوظبي، الإمارات العربية المتحدة",
    "Sat – Thu: 9:00 AM – 1:00 PM & 4:00 PM – 9:00 PM · Fri: 4:00 PM – 9:00 PM": "السبت – الخميس: 9:00 ص – 1:00 م و 4:00 م – 9:00 م · الجمعة: 4:00 م – 9:00 م",
    "Questions": "أسئلة", "Frequently Asked Questions": "الأسئلة الشائعة",
    "Can I finance a car?": "هل يمكنني تمويل سيارة؟",
    "Finance options are available on our cars. Contact us to check your eligibility. You can start on our": "خيارات التمويل متاحة على سياراتنا. تواصل معنا للتحقق من أهليتك. يمكنك البدء عبر",
    "Finance page": "صفحة التمويل",
    "Do your cars come with a warranty?": "هل تأتي سياراتكم مع ضمان؟",
    "Can I trade in my current car?": "هل يمكنني استبدال سيارتي الحالية؟",
    "Yes. Tell us about your car on the": "نعم. أخبرنا عن سيارتك في",
    "Sell / Trade-in page": "صفحة البيع / الاستبدال",
    "and we will get back to you with an offer.": "وسنعود إليك بعرض.",
    "Which documents do I need?": "ما المستندات المطلوبة؟",
    "Our team will tell you exactly which documents are needed once you get in touch, because it depends on whether you are buying, financing or selling.": "سيخبرك فريقنا بالمستندات المطلوبة بالتحديد عند التواصل، لأن ذلك يعتمد على ما إذا كنت تشتري أو تموّل أو تبيع.",
    "Our team will tell you exactly which documents are needed once you get in touch.": "سيخبرك فريقنا بالمستندات المطلوبة بالتحديد عند التواصل.",
    "Can I take a test drive?": "هل يمكنني تجربة القيادة؟",
    "Contact us or visit the showroom to arrange a test drive on the car you like.": "تواصل معنا أو زر المعرض لترتيب تجربة قيادة للسيارة التي تعجبك.",
    "Send us a message": "أرسل لنا رسالة",
    "Name *": "الاسم *", "Email *": "البريد الإلكتروني *", "Message *": "الرسالة *", "Send Message": "إرسال الرسالة",
    "Prefer to talk?": "تفضل التحدث؟", "Call us": "اتصل بنا", "WhatsApp": "واتساب", "Chat with us": "تحدث معنا",

    /* ---- Footer ---- */
    "DriveX Motors is Abu Dhabi’s destination for premium, fully-inspected pre-owned vehicles — luxury SUVs, sedans and sports cars with transparent pricing and flexible finance.": "DriveX Motors وجهتك في أبوظبي للسيارات المستعملة الفاخرة المفحوصة بالكامل — سيارات دفع رباعي فاخرة وسيدان وسيارات رياضية بأسعار شفافة وتمويل مرن.",
    "Explore": "استكشف", "Sold Cars": "السيارات المباعة", "About Us": "من نحن", "Get in Touch": "تواصل معنا",
    "We’re located in the heart of Abu Dhabi.": "نحن في قلب أبوظبي.", "Open in Google Maps": "افتح في خرائط جوجل",
    "Premium pre-owned vehicles · Abu Dhabi, UAE": "سيارات مستعملة فاخرة · أبوظبي، الإمارات",
    "Chat on WhatsApp": "تحدث عبر واتساب", "Chat with us on WhatsApp": "تحدث معنا عبر واتساب",
    "Back to top": "العودة للأعلى", "Facebook": "فيسبوك", "Instagram": "إنستغرام",

    /* ---- Inventory ---- */
    "Find your next car": "اعثر على سيارتك القادمة", "Vehicle Inventory": "السيارات المتوفرة",
    "Browse our full range of premium pre-owned vehicles in Abu Dhabi.": "تصفح مجموعتنا الكاملة من السيارات المستعملة الفاخرة في أبوظبي.",
    "Filters": "التصفية", "Sort": "الترتيب", "Newest first": "الأحدث أولاً", "Oldest first": "الأقدم أولاً",
    "Name: A to Z": "الاسم: أ إلى ي", "Name: Z to A": "الاسم: ي إلى أ",
    "Price: Low to High": "السعر: من الأقل للأعلى", "Price: High to Low": "السعر: من الأعلى للأقل",
    "Mileage: Lowest": "المسافة: الأقل", "Mileage: Highest": "المسافة: الأعلى",
    "Year: Newest": "السنة: الأحدث", "Year: Oldest": "السنة: الأقدم", "Most Popular": "الأكثر رواجاً",
    "Reset": "إعادة تعيين", "Make": "الماركة", "All makes": "كل الماركات", "Body Type": "نوع الهيكل", "All types": "كل الأنواع",
    "Fuel Type": "نوع الوقود", "All fuels": "كل أنواع الوقود", "Transmission": "ناقل الحركة", "All": "الكل",
    "Year": "السنة", "Price (AED)": "السعر (درهم)", "Max Mileage (km)": "أقصى مسافة (كم)", "Apply Filters": "تطبيق التصفية",
    "Loading…": "جارٍ التحميل…", "No vehicles match your search": "لا توجد سيارات تطابق بحثك",
    "Try adjusting or resetting your filters.": "جرّب تعديل التصفية أو إعادة تعيينها.", "Reset Filters": "إعادة تعيين التصفية",
    "Search make, model, keyword…": "ابحث بالماركة أو الموديل أو كلمة…", "Close filters": "إغلاق التصفية",
    "From": "من", "To": "إلى", "Min": "الأدنى", "Max": "الأقصى", "Any": "أي",
    "Inventory pages": "صفحات السيارات", "Remove filter": "إزالة التصفية",
    "vehicles found": "سيارات موجودة", "vehicle found": "سيارة موجودة",
    "No vehicles available yet. Please check back soon.": "لا توجد سيارات متاحة حالياً. يرجى العودة قريباً.",
    "Unable to load vehicles right now.": "تعذر تحميل السيارات الآن.",
    "Unable to load inventory. Please retry.": "تعذر تحميل السيارات. يرجى المحاولة مرة أخرى.",
    "‹ Prev": "‹ السابق", "Next ›": "التالي ›",

    /* ---- Vehicle card + detail ---- */
    "View Details": "عرض التفاصيل", "Sold": "مباع", "Reserved": "محجوز", "Coming Soon": "قريباً",
    "Added to favourites": "تمت الإضافة إلى المفضلة", "Removed from favourites": "تمت الإزالة من المفضلة",
    "Similar Vehicles": "سيارات مشابهة", "Breadcrumb": "مسار التنقل", "Inventory": "السيارات", "Vehicle": "السيارة",
    "Call Us": "اتصل بنا", "Share": "مشاركة", "Description": "الوصف", "Specifications": "المواصفات", "Features": "المزايا",
    "Mileage": "المسافة المقطوعة", "Fuel": "الوقود", "Engine": "المحرك", "Color": "اللون", "Price": "السعر",
    "Reserve This Car": "احجز هذه السيارة",
    "This vehicle is on its way to our showroom. Leave your details and we'll contact you the moment it arrives so you can be first in line.": "هذه السيارة في طريقها إلى معرضنا. اترك بياناتك وسنتواصل معك فور وصولها لتكون أول المستفيدين.",
    "Name": "الاسم", "Link copied to clipboard": "تم نسخ الرابط",
    "Reservation request sent!": "تم إرسال طلب الحجز!", "Could not send your reservation.": "تعذر إرسال طلب الحجز.",
    "Vehicle not found.": "لم يتم العثور على السيارة.", "Vehicle unavailable": "السيارة غير متاحة",
    "This vehicle could not be found or is no longer listed.": "تعذر العثور على هذه السيارة أو لم تعد معروضة.",
    "Back to Inventory": "العودة إلى السيارات", "Close": "إغلاق", "Previous": "السابق", "Next": "التالي",
    "Petrol": "بنزين", "Diesel": "ديزل", "Hybrid": "هجين", "Plug-in Hybrid": "هجين قابل للشحن", "Electric": "كهربائي",
    "Automatic": "أوتوماتيك", "Manual": "يدوي",
    "SUV": "دفع رباعي", "Sedan": "سيدان", "Coupe": "كوبيه", "Hatchback": "هاتشباك", "Convertible": "مكشوفة",
    "Pickup": "بيك أب", "Van": "فان", "Wagon": "ستيشن",

    /* ---- Sold page ---- */
    "Recently sold": "بيعت مؤخراً", "Sold Vehicles": "السيارات المباعة",
    "A look at cars that have found their new owners. Like one of these? We can help you find a similar vehicle.": "نظرة على سيارات وجدت مالكيها الجدد. أعجبتك إحداها؟ يمكننا مساعدتك في إيجاد سيارة مشابهة.",
    "No sold vehicles yet": "لا توجد سيارات مباعة بعد", "Browse our available cars in the inventory.": "تصفح سياراتنا المتاحة.",
    "View Inventory": "عرض السيارات", "Sold vehicle pages": "صفحات السيارات المباعة",
    "Could not load sold vehicles.": "تعذر تحميل السيارات المباعة.",
    "sold vehicles": "سيارات مباعة", "sold vehicle": "سيارة مباعة",

    /* ---- Finance ---- */
    "Car finance": "تمويل السيارات", "Finance Your": "موّل", "Next Car": "سيارتك القادمة",
    "How it works": "كيف يعمل", "Three simple steps": "ثلاث خطوات بسيطة",
    "Send your details": "أرسل بياناتك", "Fill in the short form below with what you are looking for.": "عبّئ النموذج القصير أدناه بما تبحث عنه.",
    "We get in touch": "نتواصل معك", "Our team contacts you on WhatsApp to talk through your options.": "يتواصل معك فريقنا عبر واتساب لمناقشة خياراتك.",
    "Choose your car": "اختر سيارتك", "Pick a car from our stock and we guide you through the next steps.": "اختر سيارة من مخزوننا وسنرشدك خلال الخطوات التالية.",
    "Check your eligibility": "تحقق من أهليتك", "Send us your details and we will continue the conversation on WhatsApp.": "أرسل لنا بياناتك وسنكمل المحادثة عبر واتساب.",
    "Phone *": "الهاتف *", "Monthly salary range": "نطاق الراتب الشهري", "Prefer not to say": "أفضّل عدم الذكر",
    "Under AED 5,000": "أقل من 5,000 درهم", "AED 5,000 – 10,000": "5,000 – 10,000 درهم", "AED 10,000 – 20,000": "10,000 – 20,000 درهم",
    "AED 20,000 – 40,000": "20,000 – 40,000 درهم", "Above AED 40,000": "أكثر من 40,000 درهم",
    "Preferred car": "السيارة المفضلة", "Continue on WhatsApp": "المتابعة عبر واتساب",
    "e.g. Toyota Land Cruiser, or any SUV": "مثال: تويوتا لاند كروزر، أو أي سيارة دفع رباعي",
    "Good to know": "معلومات مفيدة", "Who can apply?": "من يمكنه التقديم؟",
    "Contact us and we will check your eligibility with you. Just send the form and we will take it from there.": "تواصل معنا وسنتحقق من أهليتك معك. أرسل النموذج وسنتولى الباقي.",
    "Can I trade in my car at the same time?": "هل يمكنني استبدال سيارتي في الوقت نفسه؟",
    "Ask us how a trade-in can work together with finance on your next car.": "اسألنا كيف يمكن الجمع بين الاستبدال والتمويل لسيارتك القادمة.",
    "Please enter your name.": "يرجى إدخال اسمك.", "Please enter your phone number.": "يرجى إدخال رقم هاتفك.",
    "Opening WhatsApp…": "جارٍ فتح واتساب…", "Sending…": "جارٍ الإرسال…",

    /* ---- About ---- */
    "About DriveX Motors": "عن DriveX Motors",
    "Our Mission": "مهمتنا", "To make premium car ownership accessible, transparent and effortless for every driver in the UAE.": "جعل امتلاك السيارات الفاخرة في متناول كل سائق في الإمارات، بشفافية وسهولة.",
    "Our Vision": "رؤيتنا", "To be the most trusted pre-owned automotive brand in the region — the first name that comes to mind when quality matters.": "أن نكون العلامة الأكثر ثقة في السيارات المستعملة بالمنطقة — الاسم الأول عندما تهم الجودة.",
    "Our Values": "قيمنا", "Integrity, quality and care. We treat every customer and every vehicle with the respect they deserve.": "النزاهة والجودة والاهتمام. نعامل كل عميل وكل سيارة بالاحترام الذي يستحقه.",
    "The DriveX difference": "ما يميز DriveX", "Why Choose Us": "لماذا تختارنا",
    "Certified Quality": "جودة معتمدة", "Every vehicle is inspected and certified by our technicians.": "كل سيارة يفحصها ويعتمدها فنيونا.",
    "Transparent History": "تاريخ شفاف", "Complete, honest records on every car we sell.": "سجلات كاملة وصادقة لكل سيارة نبيعها.",
    "Flexible Finance": "تمويل مرن", "Competitive options for residents and expatriates.": "خيارات تنافسية للمقيمين والمواطنين.",
    "After-Sales Care": "خدمة ما بعد البيع", "Warranty and service packages to keep you on the road.": "باقات ضمان وصيانة تبقيك على الطريق.",
    "Find Our Showroom": "اعثر على معرضنا", "Contact Us": "اتصل بنا",
    "DriveX Motors location": "موقع DriveX Motors", "DriveX Motors location on Google Maps": "موقع DriveX Motors على خرائط جوجل",
    "Cars on display inside the DriveX Motors showroom": "سيارات معروضة داخل معرض DriveX Motors",
    "The DriveX Motors showroom at night": "معرض DriveX Motors ليلاً",

    /* ---- Contact ---- */
    "We’d love to hear from you": "يسعدنا سماعك",
    "Questions about a vehicle, finance or a trade-in? Reach out and our team will respond quickly.": "لديك سؤال عن سيارة أو تمويل أو استبدال؟ تواصل معنا وسيرد فريقنا سريعاً.",
    "Send a Message": "أرسل رسالة", "Subject": "الموضوع", "Reach Us Directly": "تواصل معنا مباشرة", "Email us": "راسلنا",
    "Message sent!": "تم إرسال الرسالة!", "Could not send message.": "تعذر إرسال الرسالة.",

    /* ---- Sell your car ---- */
    "Sell your car in Abu Dhabi": "بع سيارتك في أبوظبي", "Sell Your Car — Get a": "بع سيارتك — واحصل على", "Free Valuation": "تقييم مجاني",
    "Tell us about your vehicle and our team will review it and come back to you with an offer. Fast, transparent and completely hassle-free.": "أخبرنا عن سيارتك وسيراجعها فريقنا ويعود إليك بعرض. سريع وشفاف وبلا أي عناء.",
    "Condition": "الحالة", "Your Details": "بياناتك", "Photos": "الصور", "Review": "المراجعة",
    "Vehicle Information": "معلومات السيارة", "Make *": "الماركة *", "Model *": "الموديل *", "Year *": "السنة *", "Trim": "الفئة",
    "Mileage (km)": "المسافة (كم)", "Engine Size": "حجم المحرك", "Select…": "اختر…", "Exterior Color": "اللون الخارجي",
    "VIN Number": "رقم الهيكل (VIN)", "(optional)": "(اختياري)", "Condition & History": "الحالة والسجل",
    "Number of Owners": "عدد الملاك", "Service History Available": "سجل الصيانة متوفر", "No": "لا", "Yes": "نعم",
    "Accident History": "سجل الحوادث", "Paintwork Done": "تم إعادة الطلاء", "Mechanical Issues": "أعطال ميكانيكية",
    "Additional Notes": "ملاحظات إضافية", "Highlights": "أبرز المزايا", "Full Service History": "سجل صيانة كامل",
    "Original Paint": "طلاء أصلي", "GCC Specifications": "مواصفات خليجية", "Agency Maintained": "صيانة الوكالة",
    "Full Name *": "الاسم الكامل *", "City": "المدينة", "Phone Number *": "رقم الهاتف *", "WhatsApp Number": "رقم واتساب",
    "Email Address *": "عنوان البريد الإلكتروني *", "Vehicle Photos": "صور السيارة",
    "Add clear photos of your car (up to 20). Recommended angles:": "أضف صوراً واضحة لسيارتك (حتى 20). الزوايا المقترحة:",
    "Front View": "منظر أمامي", "Rear View": "منظر خلفي", "Left Side": "الجانب الأيسر", "Right Side": "الجانب الأيمن",
    "Interior": "الداخل", "Dashboard": "لوحة القيادة", "Odometer": "عداد المسافة", "Tap to add photos": "اضغط لإضافة الصور",
    "JPG, PNG or WEBP · up to 10 MB each · max 20": "JPG أو PNG أو WEBP · حتى 10 ميجابايت للصورة · بحد أقصى 20",
    "Your Asking Price": "السعر الذي تطلبه", "Asking Price (AED) *": "السعر المطلوب (درهم) *", "Negotiable": "قابل للتفاوض",
    "Not sure of the value? Leave it blank — our team will give you a free valuation.": "لست متأكداً من القيمة؟ اتركه فارغاً — وسيقدم لك فريقنا تقييماً مجانياً.",
    "Review & Submit": "المراجعة والإرسال", "Please review your details before submitting.": "يرجى مراجعة بياناتك قبل الإرسال.",
    "← Back": "→ رجوع", "Next →": "التالي ←", "Submit Vehicle": "إرسال السيارة", "Thank you!": "شكراً لك!",
    "Our team will review your vehicle and contact you shortly.": "سيراجع فريقنا سيارتك ويتواصل معك قريباً.", "Back to Home": "العودة للرئيسية",
    "e.g. VXR, M-Sport": "مثال: VXR, M-Sport", "e.g. 3.5L V6": "مثال: 3.5L V6",
    "Describe any known issues (optional)": "صف أي أعطال معروفة (اختياري)", "Anything else we should know? (optional)": "هل هناك ما يجب أن نعرفه؟ (اختياري)",
    "e.g. Abu Dhabi": "مثال: أبوظبي", "e.g. 85000": "مثال: 85000",
    "Make is required.": "الماركة مطلوبة.", "Model is required.": "الموديل مطلوب.", "Year is required.": "السنة مطلوبة.",
    "Enter a valid year.": "أدخل سنة صحيحة.", "Please enter your full name.": "يرجى إدخال اسمك الكامل.",
    "Please enter your email.": "يرجى إدخال بريدك الإلكتروني.", "Enter a valid email address.": "أدخل بريداً إلكترونياً صحيحاً.",
    "Asking price is required.": "السعر المطلوب إلزامي.", "Enter a valid asking price.": "أدخل سعراً صحيحاً.",
    "Please complete the required fields.": "يرجى إكمال الحقول المطلوبة.", "Submitting…": "جارٍ الإرسال…",
    "Submission failed. Please try again.": "فشل الإرسال. يرجى المحاولة مرة أخرى.", "Network error. Please try again.": "خطأ في الشبكة. يرجى المحاولة مرة أخرى.",
    "Remove": "إزالة", "Make / Model": "الماركة / الموديل", "Colour": "اللون", "VIN": "رقم الهيكل", "Owners": "الملاك",
    "Service history": "سجل الصيانة", "Accident history": "سجل الحوادث", "Paintwork done": "إعادة الطلاء",
    "Mechanical issues": "أعطال ميكانيكية", "Notes": "ملاحظات", "Asking price": "السعر المطلوب",
    "Free valuation requested": "تم طلب تقييم مجاني",

    /* ---- 404 ---- */
    "Page Not Found": "الصفحة غير موجودة", "The page you’re looking for may have been moved, sold, or never existed.": "ربما نُقلت الصفحة التي تبحث عنها أو بيعت أو لم تكن موجودة.",
    "Browse Inventory": "تصفح السيارات"
  };

  var root = document.documentElement;
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  var origText = new WeakMap();   // text node -> original English
  var origAttr = new WeakMap();   // element -> { attr: original }
  var busy = false;

  /* Patterns for strings built from numbers/units in the JS. */
  var RULES = [
    [/^© (\d{4}) (.+?)\. All rights reserved\.$/, function (m) { return '© ' + m[1] + ' ' + m[2] + '. جميع الحقوق محفوظة.'; }],
    [/^✓ (.+)$/, function (m) { return '✓ ' + (lookup(m[1]) || m[1]); }],
    [/^Up to (.+)$/, function (m) { return 'حتى ' + m[1]; }],
    [/^(.+) km$/, function (m) { return m[1] + ' كم'; }],
    [/^≤ (.+) km$/, function (m) { return '≤ ' + m[1] + ' كم'; }],
    [/^Year (.+)$/, function (m) { return 'السنة ' + m[1]; }],
    [/^Reference: (.+)$/, function (m) { return 'الرقم المرجعي: ' + m[1]; }],
    [/^(\d+) uploaded$/, function (m) { return m[1] + ' تم رفعها'; }],
    [/^Please add at least (\d+) photos of your car\.$/, function (m) { return 'يرجى إضافة ' + m[1] + ' صور على الأقل لسيارتك.'; }],
    [/^Enquiry: (.+)$/, function (m) { return 'استفسار: ' + m[1]; }],
    [/^(.+) photo (\d+)$/, function (m) { return m[1] + ' — صورة ' + m[2]; }]
  ];

  function lookup(s) {
    var t = s.replace(/\s+/g, ' ').trim();
    if (!t) return null;
    if (Object.prototype.hasOwnProperty.call(AR, t)) return AR[t];
    for (var i = 0; i < RULES.length; i++) {
      var m = RULES[i][0].exec(t);
      if (m) return RULES[i][1](m);
    }
    return null;
  }

  function translateText(node) {
    var cur = node.nodeValue;
    var src = origText.has(node) ? origText.get(node) : cur;
    // If the page changed this node itself, treat the new value as the new original.
    if (origText.has(node) && cur !== node.__dxAr) src = cur;
    var tr = lookup(src);
    if (tr === null) { origText.delete(node); return; }
    var lead = /^\s*/.exec(src)[0], trail = /\s*$/.exec(src)[0];
    origText.set(node, src);
    node.__dxAr = lead + tr + trail;
    if (node.nodeValue !== node.__dxAr) node.nodeValue = node.__dxAr;
  }

  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var map = origAttr.get(el) || {};
      var cur = el.getAttribute(a);
      var src = (a in map && cur === map[a + '__ar']) ? map[a] : cur;
      var tr = lookup(src);
      if (tr === null) continue;
      map[a] = src; map[a + '__ar'] = tr; origAttr.set(el, map);
      if (cur !== tr) el.setAttribute(a, tr);
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { translateText(node); return; }
    if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.hasAttribute('data-no-i18n')) return;
    translateAttrs(node);
    if (SKIP[node.tagName]) return;
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function restore() {
    busy = true;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (origText.has(n) && n.nodeValue === n.__dxAr) n.nodeValue = origText.get(n);
    }
    document.querySelectorAll('*').forEach(function (el) {
      var map = origAttr.get(el);
      if (!map) return;
      ATTRS.forEach(function (a) { if (a in map && el.getAttribute(a) === map[a + '__ar']) el.setAttribute(a, map[a]); });
    });
    busy = false;
  }

  var observer = new MutationObserver(function (muts) {
    if (busy || root.getAttribute('lang') !== 'ar') return;
    busy = true;
    muts.forEach(function (m) {
      if (m.type === 'attributes') translateAttrs(m.target); else m.addedNodes.forEach(walk);
    });
    busy = false;
  });

  function applyAr() {
    root.setAttribute('lang', 'ar'); root.setAttribute('dir', 'rtl');
    busy = true; walk(document.body); busy = false;
    document.title = lookup(document.title) || document.title;
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    root.classList.remove('i18n-pending');
  }
  function applyEn() {
    observer.disconnect();
    restore();
    root.setAttribute('lang', 'en'); root.setAttribute('dir', 'ltr');
    root.classList.remove('i18n-pending');
  }

  function setLang(l) {
    if (window.DXPrefs) window.DXPrefs.setLang(l);
    if (l === 'ar') applyAr(); else applyEn();
    syncButton();
  }

  function syncButton() {
    var b = document.getElementById('langToggle');
    if (!b) return;
    var ar = root.getAttribute('lang') === 'ar';
    b.textContent = ar ? 'English' : 'العربية';
    b.setAttribute('lang', ar ? 'en' : 'ar');
    b.setAttribute('data-no-i18n', '');
    b.setAttribute('aria-label', ar ? 'Switch to English' : 'التبديل إلى العربية');
    var tb = document.getElementById('themeToggle');
    if (tb) {
      var dark = root.getAttribute('data-theme') === 'dark';
      var txt = ar ? (dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن')
                   : (dark ? 'Switch to light mode' : 'Switch to dark mode');
      tb.setAttribute('aria-label', txt); tb.setAttribute('title', txt);
      tb.setAttribute('data-no-i18n', '');
    }
  }

  function init() {
    var b = document.getElementById('langToggle');
    if (b) b.addEventListener('click', function () { setLang(root.getAttribute('lang') === 'ar' ? 'en' : 'ar'); });
    if (root.getAttribute('lang') === 'ar') applyAr();
    syncButton();
  }

  window.DXi18n = { setLang: setLang, refresh: syncButton, dict: AR };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
