const router = require("express").Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const passport = require("passport");
const { loginCheck } = require("../utils/authenticatorFuncitions");
const {
  ifLoggedInRedirectToDash,
} = require("../utils/authenticatorFuncitions");
const uploader = require("../config/cloudinary");

router.get("/signup", ifLoggedInRedirectToDash(), (req, res, next) => {
  res.render("auth/signup");
});

router.post("/signup", uploader.single("profilePic"), (req, res, next) => {
  const { username, password, githubLink } = req.body;
  let profilePicInfo = {};
  if (req.file) {
    profilePicInfo.profilePic = req.file.originalname;
    profilePicInfo.profilePicPath = req.file.path;
  } else {
    profilePicInfo.profilePic = "placeholder";
    profilePicInfo.profilePicPath = "/images/profile-placeholder.png";
  }

  const errorMessage = [];
  if (password.length < 6) {
    errorMessage.push("Your password must be at least 6 characters");
  }
  if (username.length < 6) {
    errorMessage.push("Your username must be at least 6 characters");
  }
  if (errorMessage.length > 0) {
    return res.render("auth/signup", { errorMessage });
  }

  User.findOne({ username: username })
    .then((userFromDB) => {
      if (userFromDB !== null) {
        res.render("auth/signup", { message: "Username is already taken" });
      } else {
        const salt = bcrypt.genSaltSync();
        const hash = bcrypt.hashSync(password, salt);
        User.create({
          username,
          password: hash,
          githubLink,
          ...profilePicInfo,
        })
          .then((createdUser) => {
            // if we want to log the user in using passport
            // req.login()
            res.redirect("/auth/login");
          })
          .catch((err) => next(err));
      }
    })
    .catch((err) => console.log(err));
});

router.get("/login", ifLoggedInRedirectToDash(), (req, res, next) => {
  res.render("auth/login");
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/auth/login",
  })
);

router.get("/edit/:id", loginCheck(), (req, res, next) => {
  const userId = req.params.id;
  const loggedInUser = req.user;
  if (req.user.id === userId) {
    res.render("auth/edit", { loggedInUser });
  } else {
    res.redirect("/auth/login");
  }
});

router.post(
  "/edit/:id",
  loginCheck(),
  uploader.single("profilePic"),
  (req, res, next) => {
    const loggedInUser = req.user;
    const userId = req.params.id;
    if (loggedInUser.id === userId) {
      const newInfo = {};
      if (req.body.username) {
        newInfo.username = req.body.username;
      } else {
        newInfo.username = req.user.username;
      }
      if (req.body.githubLink) {
        newInfo.githubLink = req.body.githubLink;
      } else {
        newInfo.githubLink = req.user.githubLink;
      }
      if (req.file) {
        newInfo.profilePic = req.file.originalname;
        newInfo.profilePicPath = req.file.path;
      } else {
        newInfo.profilePic = req.user.profilePic;
        newInfo.profilePicPath = req.user.profilePicPath;
      }
      if (req.body.currentPass && req.body.newPass) {
        if (bcrypt.compareSync(req.body.currentPass, req.user.password)) {
          const salt = bcrypt.genSaltSync();
          const hash = bcrypt.hashSync(req.body.newPass, salt);
          newInfo.password = hash;
        } else {
          res.redirect("/auth/edit/" + req.user._id);
        }
      }
      User.findByIdAndUpdate(userId, { ...newInfo }, { new: true })
        .then((updatedProfile) => {
          res.redirect("/dashboard");
        })
        .catch((err) => console.log(err));
    } else {
      res.redirect("/auth/login");
    }
  }
);

router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// GITHUB AUTH ROUTES

router.get("/github", passport.authenticate("github"));

router.get(
  "/github/callback",
  passport.authenticate("github", {
    successRedirect: "/dashboard",
    failureRedirect: "/auth/signup",
  })
);

module.exports = router;
