/**
 * Google Apps Script - スプレッドシート書き込み用Webアプリ
 *
 * 【設定手順】
 * 1. 対象のスプレッドシートを開く
 * 2. 「拡張機能」→「Apps Script」をクリック
 * 3. エディタに以下のコードを貼り付けて保存
 * 4. 「デプロイ」→「新しいデプロイ」をクリック
 * 5. 種類：「ウェブアプリ」を選択
 * 6. 次のユーザーとして実行：「自分」
 * 7. アクセスできるユーザー：「全員」
 * 8. 「デプロイ」をクリック
 * 9. 表示されたURLをコピーして、tools/card-editor/config.local.json の gasUrl に設定する
 *
 * 【合言葉（必須）】
 * 「全員」がアクセスできるWebアプリなので、合言葉が一致しない書き込みは拒否する。
 * 1. Apps Script の「プロジェクトの設定」→「スクリプト プロパティ」に
 *    プロパティ EDITOR_SECRET、値に長いランダムな文字列を追加する
 * 2. 同じ文字列を tools/card-editor/config.local.json の gasSecret に書く（このファイルはコミットしない）
 * 3. 「デプロイを管理」→ 既存のデプロイを編集 →「新バージョン」で更新する（URLは変わらない）
 * ※ いま公開中のスクリプトにカミ設定シートの処理などが追加されている場合は、
 *   下の「合言葉の確認」の数行だけを、公開中の doPost の先頭に追加すればよい。
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 合言葉の確認（スクリプト プロパティ EDITOR_SECRET と一致しない書き込みは拒否）
    var secret = PropertiesService.getScriptProperties().getProperty("EDITOR_SECRET");
    if (!secret || data.secret !== secret) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "合言葉が一致しないため保存できません"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("カード設定");

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "シート「カード設定」が見つかりません"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // No.列（A列）からカードの行を検索
    var noColumn = sheet.getRange("A2:A" + sheet.getLastRow()).getValues();
    var targetRow = -1;

    for (var i = 0; i < noColumn.length; i++) {
      if (String(noColumn[i][0]) === String(data.no)) {
        targetRow = i + 2; // ヘッダー行分+1、0始まり分+1
        break;
      }
    }

    if (targetRow === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "No." + data.no + " のカードが見つかりません"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // B列～R列（17列）を更新 ※A列（No.）はスプレッドシート側の数式で管理するため書き込まない
    // [二つ名, カード名, ふりがな, コスト, ラウンド数, 種別, 属性, 種族, 返還値, 神攻力, 戦闘力, 効果テキスト, フレーバー, テキストサイズ, テキスト行間, トークン種別, ふりがなOffset]
    var rowData = [
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
      data.furiganaOffsetY
    ];

    sheet.getRange(targetRow, 2, 1, 17).setValues([rowData]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "No." + data.no + " を更新しました"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "エラー: " + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
