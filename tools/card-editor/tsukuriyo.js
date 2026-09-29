var app = new Vue({
  el: "#app",
  data: {
    /*  カード名関係の変数   */

    //カード名
    cardName: "",
    //カードNo.（スプレッドシート連携用）
    cardNo: "",
    //カード名文字サイズ
    nameFontsize: '"font-size:10px;"',
    //カード名Y位置（中央揃え用）
    cardNameY: 158,

    //二つ名
    cardNickname: "",
    nicknameFontsize: "",
    //二つ名の有無フラグ
    hasNickname: false,
    //二つ名Y位置（中央揃え用）
    cardNicknameY: 150,

    //ふりがな（二つ名なしのとき表示）
    cardFurigana: "",
    //ふりがなY位置オフセット（下方向がプラス）
    furiganaOffsetY: 0,

    /*  カードの各種設定値の変数   */

    //コスト
    cardCost: 0,
    //コストの文字位置
    cardCostPositionX: 0,

    //ラウンド数
    cardRound: 1,

    //返還値
    cardReturn: 1,

    //カード種別
    cardCategory: "レガシー",
    //カード種別のリスト
    cardCategoryList: [
      { label: "レガシー" },
      { label: "オラクル" },
      { label: "レリック" },
      { label: "カミ" },
    ],

    //ジェネシスカードのサブ種別（オラクル or レリック）
    riSubType: "ジェネシスオラクル",

    //カミカード専用
    kamiType: "アマテラス", // 種別（フレーム決定用）
    kamiTrigger: "", // 天力トリガーテキスト
    kamiSkill1Cost: 1, // 神技1消費天力(1-9)
    kamiSkill1Effect: "", // 神技1効果テキスト
    kamiSkill2Cost: 1, // 神技2消費天力(1-9)
    kamiSkill2Effect: "", // 神技2効果テキスト
    kamiTriggerFontSize: 28, // 天力トリガーのフォントサイズ
    kamiSkill1FontSize: 23, // 神技1効果のフォントサイズ
    kamiSkill2FontSize: 23, // 神技2効果のフォントサイズ
    kamiOrochiText: "", // ヤマタノオロチ専用テキスト（複数行・左詰め）
    kamiOrochiFontSize: 22, // ヤマタノオロチ専用テキストのフォントサイズ
    kamiCardNo: "", // スプレッドシート連携No.
    kamiCardList: {}, // カミテンプレートリスト
    kamiTypeList: [
      { label: "アマテラス" },
      { label: "ツクヨミ" },
      { label: "スサノオ" },
      { label: "ヤマトタケル" },
      { label: "オオクニヌシ" },
      { label: "タケミカヅチ" },
      { label: "オモイカネ" },
      { label: "アメノウズメ" },
      { label: "ヒノカグツチ" },
      { label: "ヤマタノオロチ" },
    ],

    //属性(色)
    cardColor: "赤",
    //属性のリスト
    cardColorList: [
      { label: "赤" },
      { label: "青" },
      { label: "緑" },
      { label: "黄" },
      { label: "紫" },
      { label: "無" },
      { label: "創" },
    ],

    //種族
    cardType: "",
    //種族のリスト
    cardTypeList: [
      { label: "忍者" },
      { label: "侍" },
      { label: "神使" },
      { label: "人獣" },
      { label: "妖怪" },
      { label: "龍" },
    ],
    //種族の文字位置
    cardTypePositionX: 0,

    //戦闘力
    cardPower: 1000,
    //戦闘力の文字位置
    cardPowerPositionX: 0,

    //攻撃力
    cardAttack: 0,

    //サブ種別
    tokenType: "銀レガシー",

    /*  画像関連変数   */
    //フレーム画像（カミカード用単一画像）
    flameImg: "",
    flameList: {},
    //フレームレイヤー（カミ以外：複数画像を重ねる）
    frameLayers: [],
    //コストアイコン
    costIconImg: "",
    //コスト枠（金枠=ユニーク用 / 銀枠=基本用。costIconImgの下レイヤー）
    costFrameImg: "",
    //ふりがなX座標（カード名フォントサイズに連動）
    furiganaX: 104,

    textColor: "#fff",
    //説明欄スタイル
    textStyle: "font-size:24px;",
    //説明欄内容
    textList: "ここに説明を入力",
    //説明欄内容（テキストボックス用）
    cardText: "ここに説明を入力",
    //説明欄フォントサイズ
    textSize: 24,
    //説明欄行間
    textHight: 8,
    //フレーバーテキスト
    cardFlavor: "ここにフレーバーを入力",

    /*　テンプレート関連　*/
    //選択中のテンプレート
    cardTemplate: "",

    //絞り込み設定：カード分類
    filterCategory: "",
    //絞り込み設定：属性
    filterColor: "",
    //絞り込み設定：種族
    filterType: "",

    //全カード情報格納用配列
    allCardList: {
      /*"key":[二つ名、分類、HP、コスト、グレード、種別、属性、種族、ラウンド数、返還値、神攻力、戦闘力、ワード、効果テキスト、ユニーク能力、フレーバーテキスト,テキストサイズ,テキスト行間]*/
    },

    //テンプレート表示用配列
    templateList: {},

    /*  システム変数   */
    //APIレスポンス格納一時配列
    APIResponceList: {},

    //ロード完了フラグ
    loaded: false,

    //画像アップロード状態管理
    select: true,

    //画像URL
    imgUrl: "",

    //GAS WebアプリURLと合言葉（スプレッドシート書き込み用）。
    //リポジトリには書かず、config.local.json（.gitignore 対象）から読み込む
    GAS_URL: "",
    GAS_SECRET: "",
    //ツクリヨのローカル確認用サーバー（npm run preview）で開いているか。本番では保存できない
    gameLinkReady: false,
    //イラストの原本：差し替えるために選んだファイル・今の切り抜き位置と、その対象のカードNo.
    pendingOriginalFile: null,
    pendingOriginalNo: "",
    artCrop: null,
    artCropNo: "",
    //保存済みの原本：番号 → ファイル名（「番号_カード名」）
    artFiles: {},
    //読み込んだカードの保存済みイラストの状態表示
    artStatus: "",
    gameLinkMessage: "確認中…",

    //一括生成の進捗表示
    batchProgress: "",

    // テンプレート設定パネルの開閉（独立）
    templatePanelOpen: true,
    // 表示中の設定パネル（'card': カード各種設定 / 'kami': カミカード設定 / '': 両方閉じる）
    activeSettingsPanel: "",
  },
  methods: {
    /*システム管理*/
    sendAPI: async function () {
      /*  APIレスポンスを受信したらロード画面を解除する  */
      let result = await this.getAPIdata();

      //ロード中フラグをオフにする
      this.loaded = true;
    },

    getAPIdata: async function () {
      /*  APIリクエストを送信し、カードデータを取得する  */
      let ret = null;
      await axios
        .get(
          "https://sheets.googleapis.com/v4/spreadsheets/1935vem2bREK2d4RNzgO6r4OvNsTsFYo2vgB8aB7AxTo/values/%E3%82%AB%E3%83%BC%E3%83%89%E8%A8%AD%E5%AE%9A!A2:S1000?key=AIzaSyBfKy2mFyg14JVUedTiFjxnXUkVzxplBXA",
        )
        .then((response) => {
          //問題なく取得できた場合は、一時配列に格納する。
          this.APIResponceList = response.data.values;
        })
        .catch((error) => {
          //エラーが発生した場合は、エラーメッセージを返却する。
          console.log("API取得エラー" + error);
        });

      var newList = {};
      for (var i = 0; i < this.APIResponceList.length; i++) {
        if (
          this.APIResponceList[i] != "" &&
          this.APIResponceList[i].length >= 3
        ) {
          var no = this.APIResponceList[i][0];
          var cardName = this.APIResponceList[i][2];
          var displayKey = "No." + no + " " + cardName;
          newList[displayKey] = this.APIResponceList[i];
        }
      }
      this.allCardList = newList;
      this.templateList = newList;
      return ret;
    },

    imageDL() {
      /*  作成した画像をダウンロードする  */
      var svg = this.$refs.svgArea;
      var data = new XMLSerializer().serializeToString(this.$refs.svgArea);
      var canvas = document.createElement("canvas");
      canvas.width = 744;
      canvas.height = 1039;
      var ctx = canvas.getContext("2d");
      var image = new Image();
      image.onload = () => {
        // SVGデータをPNG形式に変換する
        console.log(image.width, image.height);
        ctx.drawImage(image, 0, 0, 744, 1039);
        this.imgUrl = canvas.toDataURL("image/png");
        var dllink = document.createElement("a");
        dllink.href = this.imgUrl;
        dllink.download = this.cardName;
        dllink.click();
      };
      image.src =
        "data:image/svg+xml;charset=utf-8;base64," +
        btoa(unescape(encodeURIComponent(data)));
    },

    /*フラグ切り替え*/
    cropSwitch: function () {
      /*  画像ファイルアップロード時、状態を切り替える  */
      this.select = !this.select;
    },

    /*　説明欄編集関連　*/
    textSet: function () {
      var size = Number(this.textSize);
      var textLen = this.cardText.length;
      var areaWidth = 600;
      var areaHeight = 220;
      var lineHeight = Number(this.textHight);

      //テキストが長い場合、自動でフォントサイズを縮小
      var charsPerLine = Math.floor(areaWidth / size);
      var lines = Math.ceil(textLen / charsPerLine);
      var totalHeight = lines * (size + lineHeight);
      while (totalHeight > areaHeight && size > 12) {
        size--;
        charsPerLine = Math.floor(areaWidth / size);
        lines = Math.ceil(textLen / charsPerLine);
        totalHeight = lines * (size + lineHeight);
      }

      this.textSpace = size + lineHeight;
      this.textList = this.cardText;
      this.textStyle =
        "font-size:" +
        size +
        "px; line-height:" +
        this.textSpace +
        "px; color:#fff;";
    },

    flameSet: function () {
      /*  カードの種類に合ったフレームレイヤーを設定する（frames.jsのFRAME_IMAGESを使用）  */
      this.frameLayers = [];
      this.costIconImg = "";
      this.costFrameImg = "";

      if (this.cardCategory == "カミ") {
        this.flameImg = FRAME_IMAGES["カミ_" + this.kamiType] || "";
        this.textColor = "#fff";
        return;
      }

      var color = this.cardColor;

      // 創属性（ジェネシス）: 変更なし
      if (color === "創") {
        var isGenDragon = this.cardType === "龍";
        this.frameLayers.push(
          FRAME_IMAGES[isGenDragon ? "創_土台_龍" : "創_土台"] || "",
        );
        if (isGenDragon) {
          this.costIconImg = FRAME_IMAGES["アイコン_無_龍"] || "";
          this.costFrameImg = FRAME_IMAGES["アイコン_赤枠_龍"] || "";
        } else {
          this.costIconImg = FRAME_IMAGES["アイコン_創_オラクル"] || "";
          this.costFrameImg = FRAME_IMAGES["アイコン_銀枠_オラクル"] || "";
        }
        this.textColor = "#fff";
        return;
      }

      // 龍判定（レガシーのみ適用）
      var isDragon = this.cardCategory === "レガシー" && this.cardType === "龍";

      // Layer 1: 土台（カテゴリ・龍で出し分け）
      if (isDragon) {
        this.frameLayers.push(FRAME_IMAGES[color + "_土台_龍"] || "");
      } else if (this.cardCategory === "レガシー") {
        this.frameLayers.push(FRAME_IMAGES[color + "_レガシー_土台"] || "");
      } else if (this.cardCategory === "オラクル") {
        this.frameLayers.push(FRAME_IMAGES[color + "_オラクル_土台"] || "");
      } else if (this.cardCategory === "レリック") {
        this.frameLayers.push(FRAME_IMAGES[color + "_レリック_土台"] || "");
      }

      // Layer 2: 枠（無属性は枠なし、返還値0は枠なし、それ以外はカテゴリ別ユニーク/基本）
      if (color !== "無" && (isDragon || Number(this.cardReturn) === 1 || Number(this.cardReturn) === 2)) {
        var isUnique = isDragon || Number(this.cardReturn) === 1;
        if (this.cardCategory === "レガシー") {
          this.frameLayers.push(
            FRAME_IMAGES[isUnique ? "枠_ユニーク_レガシー" : "枠_基本_レガシー"] || "",
          );
        } else if (this.cardCategory === "オラクル") {
          this.frameLayers.push(
            FRAME_IMAGES[isUnique ? "枠_ユニーク_オラクル" : "枠_基本_オラクル"] || "",
          );
        } else if (this.cardCategory === "レリック") {
          this.frameLayers.push(
            FRAME_IMAGES[isUnique ? "枠_ユニーク_レリック" : "枠_基本_レリック"] || "",
          );
        }
      }

      // Layer 3: 二つ名（レガシーのみ、二つ名ありかつ龍or返還値1か2。龍は専用二つ名画像）
      if (
        this.cardCategory == "レガシー" &&
        this.hasNickname &&
        (isDragon ||
          Number(this.cardReturn) === 1 ||
          Number(this.cardReturn) === 2)
      ) {
        if (isDragon) {
          this.frameLayers.push(FRAME_IMAGES[color + "_二つ名_龍"] || "");
        } else {
          this.frameLayers.push(FRAME_IMAGES[color + "_二つ名"] || "");
        }
        if (isDragon || Number(this.cardReturn) === 1) {
          this.frameLayers.push(FRAME_IMAGES["枠_ユニーク_二つ名"] || "");
        } else {
          this.frameLayers.push(FRAME_IMAGES["枠_基本_二つ名"] || "");
        }
      }

      // コストアイコン + コスト枠（金枠=ユニーク系、銀枠=基本系）
      if (this.cardCategory == "レガシー") {
        var costFrame =
          color !== "無" && (isDragon || Number(this.cardReturn) === 1)
            ? "金枠"
            : "銀枠";
        this.costIconImg =
          FRAME_IMAGES["アイコン_" + color + "_" + this.cardType] || "";
        this.costFrameImg =
          FRAME_IMAGES["アイコン_" + costFrame + "_" + this.cardType] || "";
      } else if (this.cardCategory == "オラクル") {
        var costFrame =
          color !== "無" && Number(this.cardReturn) === 1 ? "金枠" : "銀枠";
        this.costIconImg =
          FRAME_IMAGES["アイコン_" + color + "_オラクル"] || "";
        this.costFrameImg =
          FRAME_IMAGES["アイコン_" + costFrame + "_オラクル"] || "";
      } else if (this.cardCategory == "レリック") {
        var costFrame =
          color !== "無" && Number(this.cardReturn) === 1 ? "金枠" : "銀枠";
        this.costIconImg =
          FRAME_IMAGES["アイコン_" + color + "_レリック"] || "";
        this.costFrameImg =
          FRAME_IMAGES["アイコン_" + costFrame + "_レリック"] || "";
      }

      this.textColor = "#fff";
    },
    templateSet: function () {
      /*  選択されたテンプレートに沿って画像を設定する  */
      var selectTmp = this.$refs.tempRef.value;
      if (!selectTmp == "") {
        /*"配列":[No., 二つ名, カード名, ふりがな, コスト, ラウンド数, 種別, 属性, 種族, 返還値, 神攻力, 戦闘力, 効果テキスト, フレーバー, テキストサイズ, テキスト行間, サブ種別]*/
        var d = this.templateList[selectTmp];

        //カードNo.
        this.cardNo = d[0] || "";

        //カード名、二つ名、ふりがな、カード分類
        this.cardName = (d[2] || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
        this.cardNickname = d[1] || "";
        this.hasNickname = (d[1] || "") !== "";
        this.cardFurigana = d[3] || "";
        this.furiganaOffsetY = Number(d[17]) || 0;
        this.cardCategory = d[6] || "";

        // 旧データ互換：category="トークン" は "無"色の各種別に変換
        if (this.cardCategory == "トークン") {
          var ttype = d[16] || "銀レガシー";
          this.cardCategory =
            ttype == "銀オラクル"
              ? "オラクル"
              : ttype == "銀レリック"
                ? "レリック"
                : "レガシー";
          this.cardColor = "無";
        }

        //コスト、効果テキスト、フレーバー、テキスト設定
        this.cardCost = d[4] || 0;
        this.cardText = d[12] || "";
        this.cardFlavor = d[13] || "";
        this.textSize = d[14] || 24;
        this.textHight = d[15] || 8;

        //属性はレガシー、オラクル、レリックに設定
        if (
          this.cardCategory == "レガシー" ||
          this.cardCategory == "オラクル" ||
          this.cardCategory == "レリック"
        ) {
          this.cardColor = d[7] || "";
        }

        //種族、神攻力、戦闘力はレガシーに設定（それ以外はリセット）
        if (this.cardCategory == "レガシー") {
          this.cardType = d[8] || "";
          this.cardAttack = d[10] || 0;
          this.cardPower = d[11] || 0;
        } else {
          this.cardType = "";
          this.cardAttack = 0;
          this.cardPower = 0;
        }

        //ラウンド数・返還値はレガシー、オラクル、レリックのみ設定
        if (
          this.cardCategory == "レガシー" ||
          this.cardCategory == "オラクル" ||
          this.cardCategory == "レリック"
        ) {
          this.cardRound = d[5] || 1;
          this.cardReturn = d[9] || 0;
        }

        this.activeSettingsPanel = "card";
        this.flameSet();
        this.textSet();
        // リポジトリに保存済みのイラストがあれば、自動でカードに載せる
        this._loadArtForCard(this.cardNo);
      }
    },
    saveToSheet: async function (silent) {
      /*  編集中のカード情報をスプレッドシートに上書き保存する  */
      if (!this.cardNo) {
        alert(
          "テンプレートが選択されていません。\n先にテンプレートからカードを読み込んでください。",
        );
        return;
      }
      if (!this.GAS_URL || !this.GAS_SECRET) {
        if (silent === true) throw new Error("config.local.json に gasUrl と gasSecret を設定してください");
        alert(
          "シートの保存先が設定されていません。\ntools/card-editor/config.local.json に gasUrl と gasSecret を設定してください。",
        );
        return;
      }

      // 種別ごとに使用するフィールドを判定（未使用フィールドは空で保存）
      var cat = this.cardCategory;
      var useColor =
        cat == "レガシー" || cat == "オラクル" || cat == "レリック";
      var useRoundReturn =
        cat == "レガシー" || cat == "オラクル" || cat == "レリック";
      var useTypeAttackPower = cat == "レガシー";
      var useTokenType = cat == "ジェネシス";

      var data = {
        secret: this.GAS_SECRET,
        no: this.cardNo,
        nickname: this.cardNickname,
        name: this.cardName,
        cost: this.cardCost,
        round: useRoundReturn ? this.cardRound : "",
        category: cat,
        color: useColor ? this.cardColor : "",
        type: useTypeAttackPower ? this.cardType : "",
        returnValue: useRoundReturn ? this.cardReturn : "",
        attack: useTypeAttackPower ? this.cardAttack : "",
        power: useTypeAttackPower ? this.cardPower : "",
        text: this.cardText,
        flavor: this.cardFlavor,
        textSize: this.textSize,
        textHeight: this.textHight,
        tokenType: useTokenType ? this.riSubType : "",
        furigana: this.cardFurigana,
        furiganaOffsetY: this.furiganaOffsetY,
      };

      try {
        var response = await fetch(this.GAS_URL, {
          method: "POST",
          body: JSON.stringify(data),
        });
        var result = await response.json();
        if (result.success) {
          // allCardListのデータも更新する
          var key = "No." + this.cardNo + " " + this.cardName;
          var updatedRow = [
            data.no,
            data.nickname,
            data.name,
            data.furigana,
            data.cost,
            data.round,
            data.category,
            data.color,
            data.type,
            data.returnValue,
            data.attack,
            data.power,
            data.text,
            data.flavor,
            data.textSize,
            data.textHeight,
            data.tokenType,
            data.furiganaOffsetY,
          ];
          // 旧キーを削除して新キーで登録（カード名変更対応）
          for (var oldKey in this.allCardList) {
            if (this.allCardList[oldKey][0] == data.no) {
              delete this.allCardList[oldKey];
              break;
            }
          }
          this.allCardList[key] = updatedRow;
          this.templateList = Object.assign({}, this.allCardList);

          if (silent !== true) alert(result.message);
        } else {
          if (silent === true) throw new Error("シートへの保存に失敗: " + result.message);
          alert("保存失敗: " + result.message);
        }
      } catch (error) {
        if (silent === true) throw error;
        alert("通信エラー: " + error.message);
      }
    },

    loadKamiSheet: async function (silent) {
      /*  カミ設定シートからカードリストを読み込む  */
      var KAMI_SHEET_URL =
        "https://sheets.googleapis.com/v4/spreadsheets/1935vem2bREK2d4RNzgO6r4OvNsTsFYo2vgB8aB7AxTo/values/" +
        encodeURIComponent("カミ設定") +
        "!A2:N1000?key=AIzaSyBfKy2mFyg14JVUedTiFjxnXUkVzxplBXA";
      try {
        var response = await axios.get(KAMI_SHEET_URL);
        var rows = response.data.values || [];
        this.kamiCardList = {};
        rows.forEach(
          function (row) {
            var no = row[0] || "";
            var name = row[2] || ""; // C列：名称（カード名）
            if (no && name) {
              var key = "No." + no + " " + name;
              this.kamiCardList[key] = row;
            }
          }.bind(this),
        );
        this.loaded = true;
        if (!silent)
          alert(
            "カミシートを読み込みました（" +
              Object.keys(this.kamiCardList).length +
              "件）",
          );
      } catch (e) {
        if (!silent) alert("カミシート読み込みエラー: " + e.message);
      }
    },

    setKamiTemplate: function () {
      /*  カミテンプレートを設定する  */
      var selectTmp = this.$refs.kamiTempRef.value;
      if (!selectTmp) return;
      var d = this.kamiCardList[selectTmp];
      if (!d) return;
      // [No., カード名, 二つ名, 天カトリガー, スキル1, スキル1天力, スキル2, スキル2天力, カミ種別, cardNo]
      // [No., 二つ名, 名称, 種別, 天力トリガー, 神技1名称(未使用), 神技1消費天力, 神技1効果, 神技2名称(未使用), 神技2消費天力, 神技2効果]
      this.kamiCardNo = d[0] || "";
      this.cardNickname = d[1] || "";
      this.hasNickname = (d[1] || "") !== "";
      this.cardName = (d[2] || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
      this.kamiType = (d[2] || "").replace(/[\u200B-\u200D\uFEFF\s]/g, "");
      this.kamiTrigger = d[4] || "";
      // d[5]: 神技1名称（フレームに埋め込み済みのため読み込み不要）
      this.kamiSkill1Cost = Number(d[6]) || 1;
      this.kamiSkill1Effect = d[7] || "";
      // d[8]: 神技2名称（フレームに埋め込み済みのため読み込み不要）
      this.kamiSkill2Cost = Number(d[9]) || 1;
      this.kamiSkill2Effect = d[10] || "";
      this.kamiTriggerFontSize = Number(d[11]) || 28;
      this.kamiSkill1FontSize = Number(d[12]) || 23;
      this.kamiSkill2FontSize = Number(d[13]) || 23;
      // ヤマタノオロチ専用：天力トリガーを効果テキストに、神技1・2は独立表示
      if (this.kamiType === "ヤマタノオロチ") {
        this.kamiOrochiText = this.kamiTrigger || "";
        this.kamiOrochiFontSize = Number(d[11]) || 22;
      }
      this.cardCategory = "カミ";
      this.activeSettingsPanel = "kami";
      this.flameSet();
    },

    saveKamiToSheet: async function (silent) {
      /*  カミカード情報をスプレッドシートに保存する  */
      if (!this.kamiCardNo) {
        alert("カミテンプレートが選択されていません。");
        return;
      }
      if (!this.GAS_URL || !this.GAS_SECRET) {
        if (silent === true) throw new Error("config.local.json に gasUrl と gasSecret を設定してください");
        alert("シートの保存先が設定されていません。tools/card-editor/config.local.json に gasUrl と gasSecret を設定してください。");
        return;
      }
      var data = {
        secret: this.GAS_SECRET,
        sheet: "カミ設定",
        no: this.kamiCardNo,
        nickname: this.cardNickname,
        name: this.cardName,
        kamiType: this.kamiType,
        trigger: this.kamiTrigger,
        skill1Cost: this.kamiSkill1Cost,
        skill1Effect: this.kamiSkill1Effect,
        skill2Cost: this.kamiSkill2Cost,
        skill2Effect: this.kamiSkill2Effect,
        triggerFontSize: this.kamiTriggerFontSize,
        skill1FontSize: this.kamiSkill1FontSize,
        skill2FontSize: this.kamiSkill2FontSize,
      };
      try {
        var response = await fetch(this.GAS_URL, {
          method: "POST",
          body: JSON.stringify(data),
        });
        var result = await response.json();
        if (result.success) {
          if (silent !== true) alert(result.message);
        } else {
          if (silent === true) throw new Error("シートへの保存に失敗: " + result.message);
          alert("保存失敗: " + result.message);
        }
      } catch (error) {
        if (silent === true) throw error;
        alert("通信エラー: " + error.message);
      }
    },

    /* ===== ツクリヨへの反映（ローカル専用） ===== */
    _loadEditorConfig: async function () {
      /*  config.local.json（GASのURLと合言葉）と、ローカル確認用サーバーの保存機能を確かめる  */
      try {
        var res = await fetch("config.local.json", { cache: "no-store" });
        if (res.ok) {
          var cfg = await res.json();
          this.GAS_URL = cfg.gasUrl || "";
          this.GAS_SECRET = cfg.gasSecret || "";
        }
      } catch (e) { /* 設定なし */ }
      try {
        var ping = await fetch("/__dev/ping", { cache: "no-store" });
        var info = ping.ok ? await ping.json() : null;
        this.gameLinkReady = !!(info && info.ok);
      } catch (e) {
        this.gameLinkReady = false;
      }
      var notes = [];
      if (!this.gameLinkReady) notes.push("ゲームへの画像反映：使えません（npm run preview で開いてください）");
      if (!this.GAS_URL || !this.GAS_SECRET) notes.push("シートへの保存：config.local.json が未設定です");
      this.gameLinkMessage = notes.length ? notes.join(" ／ ") : "ローカル確認用サーバーに接続中：保存するとゲームにすぐ反映されます";
    },

    _publishImageToGame: async function (pngBlob, no, isKami) {
      /*  744×1039のPNGを、ゲーム用のWebP（幅600・320）に縮小・圧縮してツクリヨの画像フォルダへ保存する  */
      if (!this.gameLinkReady) throw new Error("ローカル確認用サーバー（npm run preview）で開いていないため保存できません");
      if (!pngBlob) throw new Error("カード画像の作成に失敗しました");
      var bitmap = await createImageBitmap(pngBlob);
      var warnings = [];
      var sizes = [[600, 838], [320, 447]];
      for (var i = 0; i < sizes.length; i++) {
        var canvas = document.createElement("canvas");
        canvas.width = sizes[i][0];
        canvas.height = sizes[i][1];
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        var webp = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/webp", 0.88); });
        if (!webp || webp.type !== "image/webp") throw new Error("このブラウザではWebPを作成できません（Chrome / Edge を使ってください）");
        var res = await fetch("/__dev/card-image?kind=" + (isKami ? "kami" : "card") + "&no=" + encodeURIComponent(no) + "&w=" + sizes[i][0], {
          method: "POST",
          headers: { "Content-Type": "image/webp" },
          body: webp,
        });
        var result = await res.json().catch(function () { return {}; });
        if (!res.ok || !result.ok) throw new Error(result.message || ("保存に失敗しました（" + res.status + "）"));
        if (result.warning && warnings.indexOf(result.warning) === -1) warnings.push(result.warning);
      }
      bitmap.close && bitmap.close();
      return warnings;
    },

    /* ===== イラストの原本（art/番号_カード名.webp）と切り抜き位置（art/番号_カード名.json） =====
       原本はカードに載せるイラストをそのまま（長辺3000pxまで・WebP）保存し、
       カードに載せる正方形の範囲は切り抜き位置として別に保存する。あとから範囲の調整や原本の差し替えができる。
       ファイル名はドライブの元イラストと同じ「番号_カード名」。番号からファイル名を引くため一覧を持っておく。 */
    _refreshArtFiles: async function () {
      try {
        var list = await (await fetch("/__dev/card-art-list", { cache: "no-store" })).json();
        this.artFiles = (list && list.files) || {};
      } catch (e) {
        this.artFiles = {};
      }
    },
    _artUrl: function (no, ext) {
      var base = (this.artFiles || {})[String(parseInt(no, 10))];
      return base ? "art/" + encodeURIComponent(base) + "." + (ext || "webp") : null;
    },
    _artDisplayName: function (nickname, name) {
      /*  ファイル名に使うカード名（二つ名があれば「二つ名・カード名」。一括生成のZIPと同じ）  */
      var clean = function (s) { return String(s || "").replace(/[​-‍﻿]/g, ""); };
      return clean(nickname) ? clean(nickname) + "・" + clean(name) : clean(name);
    },
    _artNameFromFile: function (fileName) {
      /*  「001_カード名.png」からカード名の部分を取り出す  */
      return String(fileName || "").replace(/^\d+_/, "").replace(/\.[^.]+$/, "");
    },
    _defaultArtCrop: function (width, height) {
      /*  一括生成と同じ既定の切り抜き（中央・上端基準の正方形）  */
      var size = Math.min(width, height);
      return { x: Math.round((width - size) / 2), y: 0, width: size, height: size };
    },
    _cropToCard: function (img, crop) {
      /*  原本から切り抜き範囲をカードのイラスト枠（585px）に描く  */
      var canvas = document.createElement("canvas");
      canvas.width = 585;
      canvas.height = 585;
      canvas.getContext("2d").drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, 585, 585);
      document.getElementById("cardImage").setAttribute("href", canvas.toDataURL());
    },
    _openArtInCropper: function (src, crop) {
      /*  原本を切り抜き画面に開き、保存済みの切り抜き位置を再現してカードに載せる  */
      var self = this;
      return new Promise(function (resolve) {
        if (window.cropper) { try { window.cropper.destroy(); } catch (e) { /* 既に破棄済み */ } }
        var imgEl = document.getElementById("cropper-area");
        imgEl.onload = function () {
          imgEl.onload = null;
          window.cropper = new Cropper(imgEl, {
            dragMode: "move", aspectRatio: 1, autoCropArea: 1, viewMode: 1,
            ready: function () {
              if (crop) window.cropper.setData(crop);
              self._applyCropperToCard();
              resolve();
            },
          });
        };
        imgEl.src = src;
        self.select = false; // 「削除」ボタンを出す（原本を開いている状態）
      });
    },
    _applyCropperToCard: function () {
      /*  切り抜き画面の範囲をカードに反映し、保存用の切り抜き位置を覚える  */
      if (!window.cropper) return;
      var canvas = window.cropper.getCroppedCanvas({ width: 585, height: 585 });
      if (canvas) document.getElementById("cardImage").setAttribute("href", canvas.toDataURL());
      var d = window.cropper.getData(true);
      this.artCrop = { x: d.x, y: d.y, width: d.width, height: d.height };
      this.artCropNo = this.cardNo;
    },
    onArtFileSelected: function (file) {
      /*  新しい原本を選んだとき：切り抜き画面に開き、「シートとゲームに反映」で原本を差し替える  */
      var self = this;
      var reader = new FileReader();
      reader.onload = function () {
        self.pendingOriginalFile = file;
        self.pendingOriginalNo = self.cardNo;
        self._openArtInCropper(String(reader.result), null).then(function () {
          self.artStatus = "新しい原本を読み込みました。範囲を調整して「カードに反映」→「シートとゲームに反映」で保存されます";
        });
      };
      reader.readAsDataURL(file);
    },
    _loadArtForCard: async function (no) {
      /*  保存済みの原本と切り抜き位置を読み込んで、切り抜き画面とカードに載せる  */
      this.artStatus = "";
      this.artCrop = null;
      this.artCropNo = "";
      this.pendingOriginalFile = null;
      this.pendingOriginalNo = "";
      if (!no) return false;
      try {
        await this._refreshArtFiles();
        var url = this._artUrl(no);
        var res = url ? await fetch(url, { cache: "no-store" }) : null;
        if (!res || !res.ok) { this.artStatus = "保存済みの原本なし（イラストのファイルを選んで「カードに反映」してください）"; return false; }
        var blob = await res.blob();
        var crop = null;
        var cropRes = await fetch(this._artUrl(no, "json"), { cache: "no-store" });
        if (cropRes.ok) crop = await cropRes.json().catch(function () { return null; });
        var dataUrl = await new Promise(function (resolve) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.readAsDataURL(blob); });
        await this._openArtInCropper(dataUrl, crop);
        this.artStatus = "保存済みの原本を読み込みました（範囲はドラッグで調整して「カードに反映」、原本の差し替えは「削除」→「ファイルを選択」）";
        return true;
      } catch (e) {
        this.artStatus = "原本の読み込みに失敗しました";
        return false;
      }
    },
    _originalToWebp: async function (source) {
      /*  原本をWebPにする（長辺3000pxまで。小さい画像は拡大しない）  */
      var bitmap = await createImageBitmap(source);
      var scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close && bitmap.close();
      var webp = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/webp", 0.92); });
      if (!webp || webp.type !== "image/webp") throw new Error("このブラウザではWebPを作成できません（Chrome / Edge を使ってください）");
      return { blob: webp, width: canvas.width, height: canvas.height, scale: scale };
    },
    _saveArtOriginal: async function (no, webpBlob, name) {
      // name（カード名）があれば「番号_カード名.webp」で保存し、同じ番号の古いファイルは置き換わる
      var res = await fetch("/__dev/card-art?no=" + encodeURIComponent(no) + "&name=" + encodeURIComponent(name || ""), { method: "POST", headers: { "Content-Type": "image/webp" }, body: webpBlob });
      var result = await res.json().catch(function () { return {}; });
      if (!res.ok || !result.ok) throw new Error(result.message || ("原本の保存に失敗しました（" + res.status + "）"));
    },
    _saveArtCrop: async function (no, crop, name) {
      var res = await fetch("/__dev/card-art-crop?no=" + encodeURIComponent(no) + "&name=" + encodeURIComponent(name || ""), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(crop) });
      var result = await res.json().catch(function () { return {}; });
      if (!res.ok || !result.ok) throw new Error(result.message || ("切り抜き位置の保存に失敗しました（" + res.status + "）"));
    },
    _saveArtForCurrentCard: async function (no) {
      /*  「シートとゲームに反映」のとき：差し替えた原本と、今の切り抜き位置を保存する  */
      var name = this._artDisplayName(this.cardNickname, this.cardName);
      if (this.pendingOriginalFile && String(this.pendingOriginalNo) === String(no)) {
        var converted = await this._originalToWebp(this.pendingOriginalFile);
        await this._saveArtOriginal(no, converted.blob, name);
        // 切り抜き位置は保存した原本の大きさに合わせる
        if (this.artCrop && converted.scale !== 1) {
          this.artCrop = {
            x: Math.round(this.artCrop.x * converted.scale), y: Math.round(this.artCrop.y * converted.scale),
            width: Math.round(this.artCrop.width * converted.scale), height: Math.round(this.artCrop.height * converted.scale),
          };
        }
        this.pendingOriginalFile = null;
        this.pendingOriginalNo = "";
      }
      if (this.artCrop && String(this.artCropNo) === String(no)) await this._saveArtCrop(no, this.artCrop, name);
      await this._refreshArtFiles();
    },
    _importOriginal: async function (no, file) {
      /*  原本を「番号_カード名」のまま取り込み、既定の切り抜き位置（中央・上端基準の正方形）も保存する  */
      var name = this._artNameFromFile(file.name);
      var converted = await this._originalToWebp(file);
      await this._saveArtOriginal(no, converted.blob, name);
      await this._saveArtCrop(no, this._defaultArtCrop(converted.width, converted.height), name);
    },
    importArtFolder: async function () {
      /*  「001_カード名.png」形式のイラストフォルダを、原本として art/ に取り込む  */
      if (!this.gameLinkReady) { alert("ローカル確認用サーバー（npm run preview）で開いてください。"); return; }
      var fileInput = document.getElementById("batchFolder");
      if (!fileInput.files || fileInput.files.length === 0) { alert("先に「フォルダを選択」でイラストフォルダを選んでください。"); return; }
      var files = Array.prototype.filter.call(fileInput.files, function (f) { return /^(\d+)_/.test(f.name) && /^image\//.test(f.type); });
      if (!files.length) { alert("「001_カード名.png」形式のファイルが見つかりませんでした。"); return; }
      if (!confirm(files.length + "枚のイラストを原本として取り込みます（同じNo.の原本と切り抜き位置は上書きされます）。よろしいですか？")) return;
      var done = 0;
      for (var i = 0; i < files.length; i++) {
        var no = String(parseInt(files[i].name.match(/^(\d+)_/)[1], 10));
        this.batchProgress = "原本を取り込み中… (" + (i + 1) + "/" + files.length + ") No." + no;
        try { await this._importOriginal(no, files[i]); done++; }
        catch (e) { alert("No." + no + " を取り込めませんでした：" + (e.message || e)); return; }
      }
      this.batchProgress = "完了！ " + done + "枚の原本を tools/card-editor/art/ に取り込みました。";
    },
    _loadArtForBatch: async function (no) {
      /*  一括の作り直し用：原本と切り抜き位置からカードのイラストを描く（切り抜き画面は使わない）  */
      var url = this._artUrl(no);
      var res = url ? await fetch(url, { cache: "no-store" }) : null;
      if (!res || !res.ok) return false;
      var bitmap = await createImageBitmap(await res.blob());
      var crop = null;
      var cropRes = await fetch(this._artUrl(no, "json"), { cache: "no-store" });
      if (cropRes.ok) crop = await cropRes.json().catch(function () { return null; });
      this._cropToCard(bitmap, crop || this._defaultArtCrop(bitmap.width, bitmap.height));
      bitmap.close && bitmap.close();
      return true;
    },
    regenerateAllFromSavedArt: async function () {
      /*  保存済みの原本がある全カードを、今のシートの内容で作り直してゲームに反映する（フレーム変更時など）  */
      if (!this.gameLinkReady) { alert("ローカル確認用サーバー（npm run preview）で開いてください。"); return; }
      await this._refreshArtFiles();
      var nos = Object.keys(this.artFiles || {});
      var self = this;
      var tasks = Object.keys(this.allCardList).map(function (k) { return self.allCardList[k]; }).filter(function (d) { return nos.indexOf(String(parseInt(d[0], 10))) !== -1; });
      if (!tasks.length) { alert("保存済みの原本があるカードがありません。先にイラストを取り込んでください。"); return; }
      if (!confirm(tasks.length + "枚のカード画像を作り直して、ゲームの画像を上書きします。よろしいですか？")) return;
      var warnings = [];
      for (var t = 0; t < tasks.length; t++) {
        self.batchProgress = "作り直し中… (" + (t + 1) + "/" + tasks.length + ") " + (tasks[t][2] || "");
        await self._applyTemplate(tasks[t]);
        await self._loadArtForBatch(tasks[t][0]);
        await self.$nextTick();
        await new Promise(function (r) { setTimeout(r, 100); });
        (await self._publishImageToGame(await self._svgToPng(), tasks[t][0], false)).forEach(function (w) { if (warnings.indexOf(w) === -1) warnings.push(w); });
      }
      self.batchProgress = "完了！ " + tasks.length + "枚を作り直してゲームに反映しました。" + (warnings.length ? " " + warnings.join(" ") : "");
    },

    publishToGame: async function (isKami) {
      /*  今のカードをシートに保存し、画像をゲームに反映する（1枚）  */
      var no = isKami ? this.kamiCardNo : this.cardNo;
      if (!no) { alert("テンプレートからカードを読み込んでから反映してください。"); return; }
      if (!confirm("No." + no + " をスプレッドシートとゲームの画像に反映します。よろしいですか？")) return;
      try {
        if (isKami) await this.saveKamiToSheet(true); else await this.saveToSheet(true);
        if (!isKami) await this._saveArtForCurrentCard(no);
        var warnings = await this._publishImageToGame(await this._svgToPng(), no, isKami);
        alert("No." + no + " を反映しました。ゲームを再読み込みすると確認できます。" + (warnings.length ? "\n\n" + warnings.join("\n") : ""));
      } catch (e) {
        alert("反映できませんでした：" + (e.message || e));
      }
    },

    batchGenerateToGame: function () {
      /*  一括生成の結果をZIPではなくゲームの画像フォルダへ直接保存する  */
      return this.batchGenerate(true);
    },

    batchGenerate: async function (toGame) {
      /*  イラストフォルダとスプレッドシートデータを紐づけてカード画像を一括生成する  */
      toGame = toGame === true;
      if (toGame && !this.gameLinkReady) { alert("ローカル確認用サーバー（npm run preview）で開いてください。"); return; }
      var gameWarnings = [];
      var fileInput = document.getElementById("batchFolder");
      if (!fileInput.files || fileInput.files.length === 0) {
        alert("イラストフォルダを選択してください。");
        return;
      }
      if (Object.keys(this.allCardList).length === 0) {
        alert("スプレッドシートのカードデータが読み込まれていません。");
        return;
      }

      // ファイル名からNo.を抽出してマップを作成（"001_カード名.png" → "1"）
      var imageMap = {};
      for (var i = 0; i < fileInput.files.length; i++) {
        var file = fileInput.files[i];
        var match = file.name.match(/^(\d+)_/);
        if (match) {
          var no = String(parseInt(match[1], 10)); // "001" → "1"
          imageMap[no] = file;
        }
      }

      // スプレッドシートのカードとイラストをマッチング
      var tasks = [];
      for (var key in this.allCardList) {
        var cardData = this.allCardList[key];
        var cardNo = String(cardData[0]);
        if (imageMap[cardNo]) {
          tasks.push({ key: key, data: cardData, imageFile: imageMap[cardNo] });
        }
      }

      if (tasks.length === 0) {
        alert(
          "マッチするイラストが見つかりませんでした。\nファイル名が「001_カード名.png」形式か確認してください。",
        );
        return;
      }

      this.batchProgress = "一括生成を開始します... (0/" + tasks.length + ")";

      var zip = new JSZip();
      var self = this;

      for (var t = 0; t < tasks.length; t++) {
        var task = tasks[t];
        self.batchProgress =
          "生成中... (" +
          (t + 1) +
          "/" +
          tasks.length +
          ") " +
          (task.data[2] || "");

        // テンプレートデータを設定
        await self._applyTemplate(task.data);

        // イラスト画像を読み込んでSVGに設定
        await self._loadImageToCard(task.imageFile);
        if (toGame) await self._importOriginal(task.data[0], task.imageFile);

        // Vue DOM更新を待つ
        await self.$nextTick();
        await new Promise(function (r) {
          setTimeout(r, 100);
        });

        // SVGをPNGに変換
        var pngBlob = await self._svgToPng();

        // ZIPに追加（ファイル名: "001_カード名.png"）
        var paddedNo = String(task.data[0]).padStart(3, "0");
        var nickname = (task.data[1] || "").replace(
          /[\u200B-\u200D\uFEFF]/g,
          "",
        );
        var cardName = (task.data[2] || "").replace(
          /[\u200B-\u200D\uFEFF]/g,
          "",
        );
        var displayName = nickname ? nickname + "・" + cardName : cardName;
        var fileName = "C" + paddedNo + "_" + displayName + ".png";
        if (toGame) {
          (await self._publishImageToGame(pngBlob, task.data[0], false)).forEach(function (w) { if (gameWarnings.indexOf(w) === -1) gameWarnings.push(w); });
        } else {
          zip.file(fileName, pngBlob);
        }
      }

      // カミカードを追加（テンプレート定義済みの9枚のみ、イラスト不要）
      var validKamiNames = this.kamiTypeList.map(function (k) {
        return k.label;
      });
      var kamiKeys = Object.keys(this.kamiCardList).filter(function (k) {
        var d = self.kamiCardList[k];
        var name = (d[2] || "").replace(/[\u200B-\u200D\uFEFF\s]/g, "");
        return validKamiNames.indexOf(name) !== -1;
      });
      for (var kk = 0; kk < kamiKeys.length; kk++) {
        var kamiData = this.kamiCardList[kamiKeys[kk]];
        self.batchProgress =
          "カミ生成中... (" +
          (kk + 1) +
          "/" +
          kamiKeys.length +
          ") " +
          (kamiData[2] || "");
        await self._applyKamiTemplate(kamiData);
        await self.$nextTick();
        await new Promise(function (r) {
          setTimeout(r, 100);
        });
        var kamiPng = await self._svgToPng();
        var kamiPaddedNo = String(kamiData[0]).padStart(3, "0");
        var kamiName = (kamiData[2] || "").replace(
          /[\u200B-\u200D\uFEFF]/g,
          "",
        );
        if (toGame) {
          (await self._publishImageToGame(kamiPng, kamiData[0], true)).forEach(function (w) { if (gameWarnings.indexOf(w) === -1) gameWarnings.push(w); });
        } else {
          zip.file("K" + kamiPaddedNo + "_" + kamiName + ".png", kamiPng);
        }
      }

      if (toGame) {
        self.batchProgress = "完了！ " + (tasks.length + kamiKeys.length) + "枚のカードをゲームに反映しました。" + (gameWarnings.length ? " " + gameWarnings.join(" ") : "");
        return;
      }

      self.batchProgress = "ZIPファイルを作成中...";

      zip.generateAsync({ type: "blob" }).then(function (content) {
        var link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = "cards.zip";
        link.click();
        URL.revokeObjectURL(link.href);
        self.batchProgress =
          "完了！ " +
          (tasks.length + kamiKeys.length) +
          "枚のカードを生成しました。";
      });
    },

    _applyTemplate: function (d) {
      /*  一括生成用：カードデータを設定する（templateSetと同等）  */
      this.cardNo = d[0] || "";
      this.cardName = (d[2] || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
      this.cardNickname = d[1] || "";
      this.hasNickname = (d[1] || "") !== "";
      this.cardFurigana = d[3] || "";
      this.furiganaOffsetY = Number(d[17]) || 0;
      this.cardCategory = d[6] || "";
      // 旧データ互換：category="トークン" は "無"色の各種別に変換
      if (this.cardCategory == "トークン") {
        var ttype = d[16] || "銀レガシー";
        this.cardCategory =
          ttype == "銀オラクル"
            ? "オラクル"
            : ttype == "銀レリック"
              ? "レリック"
              : "レガシー";
        this.cardColor = "無";
      }
      this.cardCost = d[4] || 0;
      this.cardText = d[12] || "";
      this.cardFlavor = d[13] || "";
      this.textSize = d[14] || 24;
      this.textHight = d[15] || 8;

      if (
        this.cardCategory == "レガシー" ||
        this.cardCategory == "オラクル" ||
        this.cardCategory == "レリック"
      ) {
        this.cardColor = d[7] || "";
      }
      if (this.cardCategory == "レガシー") {
        this.cardType = d[8] || "";
        this.cardAttack = d[10] || 0;
        this.cardPower = d[11] || 0;
      } else {
        this.cardType = "";
        this.cardAttack = 0;
        this.cardPower = 0;
      }
      if (
        this.cardCategory == "レガシー" ||
        this.cardCategory == "オラクル" ||
        this.cardCategory == "レリック"
      ) {
        this.cardRound = d[5] || 1;
        this.cardReturn = d[9] || 0;
      }

      this.flameSet();
      this.textSet();
    },

    _applyKamiTemplate: function (d) {
      /*  一括生成用：カミテンプレートを適用する  */
      // [No.,二つ名,名称,種別,天力トリガー,神技1名称,神技1消費天力,神技1効果,神技2名称,神技2消費天力,神技2効果,トリガー文字,神技1文字,神技2文字]
      this.kamiCardNo = d[0] || "";
      this.cardNickname = d[1] || "";
      this.hasNickname = (d[1] || "") !== "";
      this.cardName = (d[2] || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
      this.kamiType = (d[2] || "").replace(/[\u200B-\u200D\uFEFF\s]/g, "");
      this.kamiTrigger = d[4] || "";
      this.kamiSkill1Cost = Number(d[6]) || 1;
      this.kamiSkill1Effect = d[7] || "";
      this.kamiSkill2Cost = Number(d[9]) || 1;
      this.kamiSkill2Effect = d[10] || "";
      this.kamiTriggerFontSize = Number(d[11]) || 28;
      this.kamiSkill1FontSize = Number(d[12]) || 23;
      this.kamiSkill2FontSize = Number(d[13]) || 23;
      // ヤマタノオロチ専用：天力トリガーを効果テキストに、神技1・2は独立表示
      if (this.kamiType === "ヤマタノオロチ") {
        this.kamiOrochiText = this.kamiTrigger || "";
        this.kamiOrochiFontSize = Number(d[11]) || 22;
      }
      this.cardCategory = "カミ";
      this.flameSet();
      // カミはフレーム画像で全体が覆われるためcardImageはそのままで良い
    },

    _loadImageToCard: function (file) {
      /*  一括生成用：画像ファイルを読み込んでSVGのcardImageに設定する  */
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          // 正方形にクロップ（上部を基準）
          var img = new Image();
          img.onload = function () {
            var size = Math.min(img.width, img.height);
            var canvas = document.createElement("canvas");
            canvas.width = 585;
            canvas.height = 585;
            var ctx = canvas.getContext("2d");
            // 中央上部を基準にクロップ
            var sx = (img.width - size) / 2;
            var sy = 0;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 585, 585);
            document
              .getElementById("cardImage")
              .setAttribute("href", canvas.toDataURL());
            resolve();
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    _svgToPng: function () {
      /*  一括生成用：現在のSVGをPNG Blobに変換する  */
      var self = this;
      return new Promise(function (resolve) {
        var data = new XMLSerializer().serializeToString(self.$refs.svgArea);
        var canvas = document.createElement("canvas");
        canvas.width = 744;
        canvas.height = 1039;
        var ctx = canvas.getContext("2d");
        var image = new Image();
        image.onload = function () {
          ctx.drawImage(image, 0, 0, 744, 1039);
          canvas.toBlob(function (blob) {
            resolve(blob);
          }, "image/png");
        };
        image.onerror = function (e) {
          console.error("SVG to PNG failed", e);
          resolve(null);
        };
        image.src =
          "data:image/svg+xml;charset=utf-8;base64," +
          btoa(unescape(encodeURIComponent(data)));
      });
    },

    filteredChange: function () {
      /*  種別変更時に、付随する絞り込み項目をクリア  */
      this.filterColor = "";
      this.filterType = "";
    },

    filterClear: function () {
      /*  絞り込み項目をクリア  */
      this.filterCategory = "";
      this.filterColor = "";
      this.filterType = "";
    },

    _initCostGradients: function () {
      var svgNS = 'http://www.w3.org/2000/svg';
      var svg = document.getElementById('card');
      var defs = document.createElementNS(svgNS, 'defs');
      var gradDefs = [
        { id: 'grad-cost-red',     from: '#550000', to: '#000000' },
        { id: 'grad-cost-blue',    from: '#0d2160', to: '#000000' },
        { id: 'grad-cost-green',   from: '#0d3e07', to: '#000000' },
        { id: 'grad-cost-yellow',  from: '#564914', to: '#000000' },
        { id: 'grad-cost-purple',  from: '#31004a', to: '#000000' },
        { id: 'grad-cost-none',    from: '#000000', to: '#000000' },
        { id: 'grad-cost-sou',     from: '#30c9cd', to: '#330d69' },
        { id: 'grad-cost-sou-ryu', from: '#550000', to: '#000000' },
      ];
      gradDefs.forEach(function (g) {
        var grad = document.createElementNS(svgNS, 'linearGradient');
        grad.setAttribute('id', g.id);
        grad.setAttribute('x1', '0');
        grad.setAttribute('y1', '-70');
        grad.setAttribute('x2', '0');
        grad.setAttribute('y2', '15');
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        var stop1 = document.createElementNS(svgNS, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', g.from);
        var stop2 = document.createElementNS(svgNS, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', g.to);
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
      });
      svg.insertBefore(defs, svg.firstChild);
    },
  },
  computed: {
    /* カードテキスト編集関連 */
    cardNameMake: function () {
      /*  カード名のサイズ・位置を自動調整する（枠内中央揃え）  */
      /*  text-anchor: middle を使用し、エリアの中央Y座標を指定  */
      var cleanName = this.cardName.replace(/[\u200B-\u200D\uFEFF]/g, "");
      var nameLen = cleanName.length;
      var fontSize = 64;
      var maxHeight = 290; // 網掛け模様の内側に収まる最大高さ
      var areaCenter = 270; // エリア中央

      //フォントサイズ計算（全文字種で統一）
      // 二つ名なし（ふりがな表示あり）のとき5文字以下は小さくしてふりがなとの被りを防止
      var shortNameSize = !this.hasNickname && nameLen <= 5 ? 50 : fontSize;
      if (nameLen <= 1) {
        if (shortNameSize < 64) {
          this.nameFontsize = "font-size:" + shortNameSize + "px;";
        } else {
          this.nameFontsize = "";
        }
      } else if (nameLen == 2) {
        //2文字：文字間隔を大きく広げて余白を軽減
        if (shortNameSize < 64) {
          this.nameFontsize =
            "font-size:" + shortNameSize + "px; letter-spacing:40px;";
        } else {
          this.nameFontsize = "letter-spacing:40px;";
        }
      } else if (nameLen == 3) {
        //3文字：少し文字間隔を広げる
        if (shortNameSize < 64) {
          this.nameFontsize =
            "font-size:" + shortNameSize + "px; letter-spacing:10px;";
        } else {
          this.nameFontsize = "letter-spacing:10px;";
        }
      } else {
        //4文字以上：最大高さに収まるフォントサイズを計算
        var baseFontSize =
          !this.hasNickname && nameLen <= 5 ? shortNameSize : fontSize;
        fontSize = Math.min(baseFontSize, Math.floor(maxHeight / nameLen));

        var style = "";
        if (fontSize < 64) {
          style = "font-size:" + fontSize + "px;";
        }
        this.nameFontsize = style;
      }

      //text-anchor: middleにより、中央Y座標を指定するだけで自動中央揃え
      this.cardNameY = areaCenter;

      // ふりがなX座標: カード名の右端に追従（center=70、gap=2）
      var actualFontSize = nameLen <= 3 ? shortNameSize : fontSize;
      this.furiganaX = Math.round(72 + actualFontSize / 2);

      return cleanName;
    },

    cardNicknameMake: function () {
      /*  二つ名の位置を枠内中央揃えにする  */
      /*  text-anchor: middle を使用し、エリアの中央Y座標を指定  */
      var areaCenter = 193; // エリア中央
      var nickLen = this.cardNickname.length;

      //3文字以下の場合、文字間隔を広げて余白を軽減
      if (nickLen <= 3 && nickLen > 0) {
        this.nicknameFontsize = "letter-spacing:0.5em;";
      } else {
        this.nicknameFontsize = "";
      }

      this.cardNicknameY = areaCenter;

      return this.cardNickname;
    },
    cardCostMake: function () {
      /*  コストが2桁の場合、位置を自動調整する  */
      if (this.cardCost >= 10) {
        this.cardCostPositionX = -17;
      } else {
        this.cardCostPositionX = 0;
      }
      return this.cardCost;
    },

    costStrokeUrl: function () {
      var colorToGrad = {
        '赤': 'red',
        '青': 'blue',
        '緑': 'green',
        '黄': 'yellow',
        '紫': 'purple',
        '無': 'none',
        '創': 'sou',
      };
      if (this.cardColor === '創' && this.cardType === '龍') {
        return 'url(#grad-cost-sou-ryu)';
      }
      var key = colorToGrad[this.cardColor] || 'none';
      return 'url(#grad-cost-' + key + ')';
    },

    cardTypeMake: function () {
      /*  種族が2文字以上の場合、位置を自動調整する  */
      var nameLen = this.cardType.length;

      if (nameLen >= 2) {
        this.cardTypePositionX = -15;
      } else {
        this.cardTypePositionX = 0;
      }
      return this.cardType;
    },

    cardPowerMake: function () {
      /*  パワーの桁数に応じて位置を自動調整する（中央揃え）  */
      var nameLen = String(this.cardPower).length;

      if (nameLen >= 5) {
        this.cardPowerPositionX = -14 * (nameLen - 4);
      } else if (nameLen <= 3) {
        this.cardPowerPositionX = 14;
      } else {
        this.cardPowerPositionX = 0;
      }
      return this.cardPower;
    },

    formattedTextHtml: function () {
      var escaped = this.textList
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      var applyTm = function (text) {
        return text.replace(/\[tm\]([\s\S]*?)\[\/tm\]/g, function (_, inner) {
          return (
            "<span style=\"background:linear-gradient(180deg,#aaa,#333);border-radius:8px;padding:0 6px 4px;margin:0 4px;color:#fff;font-family:'ヒラギノ角ゴシック','Hiragino Sans',sans-serif;vertical-align:middle;font-size:0.85em;line-height:1;position:relative;top:-5px;\">" +
            inner +
            "</span>"
          );
        });
      };

      return escaped
        .split("\n")
        .map(function (line) {
          var processed = applyTm(line);
          if (line.charAt(0) === "・") {
            // 箇条書き行: flexboxで折り返し時に本文の左端を揃える
            return (
              '<div style="display:flex;align-items:flex-start;margin:0;"><span style="flex-shrink:0;min-width:1em;">・</span><span>' +
              processed.slice(1) +
              "</span></div>"
            );
          } else if (line.charAt(0) === "　") {
            // 全角スペース始まりの継続行: 箇条書き本文と同じ位置に揃える
            return (
              '<div style="margin:0 0 0 1em;">' + processed.slice(1) + "</div>"
            );
          } else {
            return '<div style="margin:0;">' + processed + "</div>";
          }
        })
        .join("");
    },

    filteredCardList: function () {
      /*  テンプレートリストにカード分類の絞り込み設定を反映  */

      if (this.filterCategory == "") {
        //デフォルト・クリア時に全カードリストを再設定
        return this.allCardList;
      }

      //絞り込み設定時、設定を反映
      var filtered = {};

      for (var [key, value] of Object.entries(this.allCardList)) {
        var category = value[6]; // 種別はG列(index 6)
        var color = value[7]; // 属性はH列(index 7)
        var type = value[8]; // 種族はI列(index 8)

        // 条件にマッチするかチェック
        const matchCategory =
          !this.filterCategory || category === this.filterCategory;
        const matchColor = !this.filterColor || color === this.filterColor;
        const matchType = !this.filterType || type === this.filterType;

        if (matchCategory && matchColor && matchType) {
          filtered[key] = value;
        }
      }

      //設定を反映したリストを返却
      return filtered;
    },
  },
  mounted() {
    this._loadEditorConfig();
    this.sendAPI();
    this.flameSet();
    this.loadKamiSheet(true);
    this._initCostGradients();
  },
});
